"""
All SLA business logic lives here.  Views and serializers must not contain
SLA calculation or mutation logic.

Key services:
  - create_sla_policy(...)
  - update_sla_policy(...)
  - create_sla_target(...)
  - update_sla_target(...)
  - calculate_incident_sla(...)   — creates IncidentSLA at incident creation
  - evaluate_sla_status(...)      — deterministic breach evaluation (no background job)
  - complete_response_sla(...)    — called on OPEN → ACKNOWLEDGED
  - complete_resolution_sla(...)  — called on IN_PROGRESS → RESOLVED
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from incidents.models import Incident, IncidentPriority
from organizations.models import Membership, Organization
from organizations.selectors import user_has_permission
from rest_framework.exceptions import ValidationError
from sla.models import IncidentSLA, SLAPolicy, SLAStatus, SLATarget
from sla.selectors import (
    get_default_sla_policy,
    get_incident_sla,
    get_sla_target,
)


class SLAValidationError(ValidationError):
    """Validation error with a stable code for SLA operations."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


# ---------------------------------------------------------------------------
# Policy management
# ---------------------------------------------------------------------------


class SLAPolicyService:
    """Business logic for SLA policy and target CRUD operations."""

    @staticmethod
    @transaction.atomic
    def create_sla_policy(
        organization: Organization,
        actor_membership: Membership,
        name: str,
        description: str = "",
        is_active: bool = True,
        is_default: bool = False,
    ) -> SLAPolicy:
        """
        Create an SLA policy for an organization.

        If is_default=True, any existing active default policy is unset first.
        Only one active-default policy is allowed per organization.
        """
        if not user_has_permission(actor_membership.user, organization, "sla.manage"):
            raise SLAValidationError(
                {"detail": "You do not have permission to manage SLA policies."},
                code="permission_denied",
            )

        clean_name = name.strip() if name else ""
        if not clean_name:
            raise SLAValidationError(
                {"name": ["SLA policy name is required."]},
                code="invalid_name",
            )

        if SLAPolicy.objects.filter(
            organization=organization, name__iexact=clean_name
        ).exists():
            raise SLAValidationError(
                {
                    "name": [
                        "An SLA policy with this name already exists in this organization."
                    ]
                },
                code="duplicate_name",
            )

        # Enforce single active-default constraint at application level
        # (backed by the partial unique index at DB level).
        if is_default and is_active:
            SLAPolicy.objects.filter(
                organization=organization,
                is_active=True,
                is_default=True,
            ).update(is_default=False)

        policy = SLAPolicy.objects.create(
            organization=organization,
            name=clean_name,
            description=description.strip() if description else "",
            is_active=is_active,
            is_default=is_default,
        )
        return policy

    @staticmethod
    @transaction.atomic
    def update_sla_policy(
        policy: SLAPolicy,
        actor_membership: Membership,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        is_default: bool | None = None,
    ) -> SLAPolicy:
        """
        Update an SLA policy.

        When setting is_default=True on a policy, any other active-default
        policy in the same organization is unset first to maintain the
        single-default invariant.
        """
        if not user_has_permission(
            actor_membership.user, policy.organization, "sla.manage"
        ):
            raise SLAValidationError(
                {"detail": "You do not have permission to manage SLA policies."},
                code="permission_denied",
            )

        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise SLAValidationError(
                    {"name": ["SLA policy name cannot be empty."]},
                    code="invalid_name",
                )
            if (
                SLAPolicy.objects.filter(
                    organization=policy.organization, name__iexact=clean_name
                )
                .exclude(id=policy.id)
                .exists()
            ):
                raise SLAValidationError(
                    {
                        "name": [
                            "An SLA policy with this name already exists in this organization."
                        ]
                    },
                    code="duplicate_name",
                )
            policy.name = clean_name

        if description is not None:
            policy.description = description.strip()

        if is_active is not None:
            policy.is_active = is_active
            # If deactivating, clear the default flag to avoid a non-active default.
            if not is_active:
                policy.is_default = False

        if is_default is not None:
            # Determine effective active state after potential update above.
            effective_active = policy.is_active if is_active is None else is_active
            if is_default and effective_active:
                # Clear any other active-default policy in this organization.
                SLAPolicy.objects.filter(
                    organization=policy.organization,
                    is_active=True,
                    is_default=True,
                ).exclude(id=policy.id).update(is_default=False)
            policy.is_default = is_default

        policy.save()
        return policy

    @staticmethod
    @transaction.atomic
    def create_sla_target(
        policy: SLAPolicy,
        actor_membership: Membership,
        priority: str,
        response_time_minutes: int,
        resolution_time_minutes: int,
    ) -> SLATarget:
        """
        Create a priority-specific SLA target within a policy.

        Tenant isolation: actor must belong to the same organization as the policy.
        """
        if actor_membership.organization_id != policy.organization_id:
            raise SLAValidationError(
                {"detail": "SLA policy does not belong to your organization."},
                code="cross_tenant",
            )

        if not user_has_permission(
            actor_membership.user, policy.organization, "sla.manage"
        ):
            raise SLAValidationError(
                {"detail": "You do not have permission to manage SLA policies."},
                code="permission_denied",
            )

        if priority not in IncidentPriority.values:
            raise SLAValidationError(
                {"priority": [f"Invalid priority '{priority}'."]},
                code="invalid_priority",
            )

        if SLATarget.objects.filter(policy=policy, priority=priority).exists():
            raise SLAValidationError(
                {
                    "priority": [
                        f"An SLA target for priority {priority} already exists in this policy."
                    ]
                },
                code="duplicate_target",
            )

        if response_time_minutes <= 0:
            raise SLAValidationError(
                {
                    "response_time_minutes": [
                        "Response time must be a positive integer."
                    ]
                },
                code="invalid_response_time",
            )

        if resolution_time_minutes <= 0:
            raise SLAValidationError(
                {
                    "resolution_time_minutes": [
                        "Resolution time must be a positive integer."
                    ]
                },
                code="invalid_resolution_time",
            )

        if resolution_time_minutes < response_time_minutes:
            raise SLAValidationError(
                {
                    "resolution_time_minutes": [
                        "Resolution time must be greater than or equal to response time."
                    ]
                },
                code="invalid_resolution_time",
            )

        return SLATarget.objects.create(
            policy=policy,
            priority=priority,
            response_time_minutes=response_time_minutes,
            resolution_time_minutes=resolution_time_minutes,
        )

    @staticmethod
    @transaction.atomic
    def update_sla_target(
        target: SLATarget,
        actor_membership: Membership,
        response_time_minutes: int | None = None,
        resolution_time_minutes: int | None = None,
    ) -> SLATarget:
        """Update time values on an existing SLA target."""
        if actor_membership.organization_id != target.policy.organization_id:
            raise SLAValidationError(
                {"detail": "SLA target does not belong to your organization."},
                code="cross_tenant",
            )

        if not user_has_permission(
            actor_membership.user, target.policy.organization, "sla.manage"
        ):
            raise SLAValidationError(
                {"detail": "You do not have permission to manage SLA policies."},
                code="permission_denied",
            )

        if response_time_minutes is not None:
            if response_time_minutes <= 0:
                raise SLAValidationError(
                    {
                        "response_time_minutes": [
                            "Response time must be a positive integer."
                        ]
                    },
                    code="invalid_response_time",
                )
            target.response_time_minutes = response_time_minutes

        if resolution_time_minutes is not None:
            if resolution_time_minutes <= 0:
                raise SLAValidationError(
                    {
                        "resolution_time_minutes": [
                            "Resolution time must be a positive integer."
                        ]
                    },
                    code="invalid_resolution_time",
                )
            target.resolution_time_minutes = resolution_time_minutes

        # Final consistency check
        if target.resolution_time_minutes < target.response_time_minutes:
            raise SLAValidationError(
                {
                    "resolution_time_minutes": [
                        "Resolution time must be greater than or equal to response time."
                    ]
                },
                code="invalid_resolution_time",
            )

        target.save()
        return target


# ---------------------------------------------------------------------------
# SLA calculation
# ---------------------------------------------------------------------------


class SLACalculationService:
    """
    Stateless SLA calculation and evaluation logic.

    These methods are intentionally pure / side-effect-free where possible
    so they can be unit-tested in isolation with deterministic/frozen time.
    """

    @staticmethod
    def calculate_incident_sla(incident: Incident) -> IncidentSLA | None:
        """
        Create an IncidentSLA record for the given incident.

        Selection strategy:
          Organization → active default SLA policy → priority-specific target

        If no active default policy exists, or no target is configured for
        the incident's priority, returns None and does NOT raise an error.
        Incident creation never fails due to a missing SLA configuration.

        Must be called inside a transaction.atomic() block (e.g. from
        IncidentService.create_incident).
        """
        policy = get_default_sla_policy(incident.organization)
        if policy is None:
            return None

        target = get_sla_target(policy, incident.priority)
        if target is None:
            return None

        now = timezone.now()
        response_deadline = now + timedelta(minutes=target.response_time_minutes)
        resolution_deadline = now + timedelta(minutes=target.resolution_time_minutes)

        return IncidentSLA.objects.create(
            incident=incident,
            policy=policy,
            response_deadline=response_deadline,
            resolution_deadline=resolution_deadline,
            response_breached=False,
            resolution_breached=False,
            response_completed_at=None,
            resolution_completed_at=None,
        )

    @staticmethod
    def evaluate_sla_status(
        sla: IncidentSLA,
        now=None,
    ) -> IncidentSLA:
        """
        Evaluate and persist breach flags on an IncidentSLA.

        Breach logic:
          - response_breached: current_time > response_deadline AND response not completed.
          - resolution_breached: current_time > resolution_deadline AND resolution not completed.

        Completed SLAs are never retroactively breached — once completed_at is set,
        the breached flag is cleared and not set again.

        This method is deterministic: pass a frozen `now` in tests.
        Returns the updated (saved) IncidentSLA.
        """
        if now is None:
            now = timezone.now()

        response_breached = (
            now > sla.response_deadline and sla.response_completed_at is None
        )
        resolution_breached = (
            now > sla.resolution_deadline and sla.resolution_completed_at is None
        )

        # If the SLA was completed before the deadline it cannot be breached.
        if sla.response_completed_at is not None:
            response_breached = False
        if sla.resolution_completed_at is not None:
            resolution_breached = False

        changed = (
            sla.response_breached != response_breached
            or sla.resolution_breached != resolution_breached
        )
        if changed:
            sla.response_breached = response_breached
            sla.resolution_breached = resolution_breached
            sla.save(
                update_fields=["response_breached", "resolution_breached", "updated_at"]
            )

        return sla

    @staticmethod
    def get_response_sla_status(sla: IncidentSLA, now=None) -> str:
        """Return the SLAStatus string for the response target."""
        if now is None:
            now = timezone.now()

        if sla.response_completed_at is not None:
            return SLAStatus.COMPLETED
        if now > sla.response_deadline:
            return SLAStatus.BREACHED
        return SLAStatus.ON_TRACK

    @staticmethod
    def get_resolution_sla_status(sla: IncidentSLA, now=None) -> str:
        """Return the SLAStatus string for the resolution target."""
        if now is None:
            now = timezone.now()

        if sla.resolution_completed_at is not None:
            return SLAStatus.COMPLETED
        if now > sla.resolution_deadline:
            return SLAStatus.BREACHED
        return SLAStatus.ON_TRACK

    @staticmethod
    @transaction.atomic
    def complete_response_sla(incident: Incident) -> IncidentSLA | None:
        """
        Mark the response SLA as completed.

        Called when the incident transitions OPEN → ACKNOWLEDGED.
        If no SLA record exists, this is a no-op.
        """
        sla = get_incident_sla(incident)
        if sla is None:
            return None
        if sla.response_completed_at is not None:
            # Already completed — idempotent.
            return sla

        sla.response_completed_at = timezone.now()
        sla.response_breached = False  # Completed before or at deadline — not breached
        sla.save(
            update_fields=["response_completed_at", "response_breached", "updated_at"]
        )
        return sla

    @staticmethod
    @transaction.atomic
    def complete_resolution_sla(incident: Incident) -> IncidentSLA | None:
        """
        Mark the resolution SLA as completed.

        Called when the incident transitions IN_PROGRESS → RESOLVED.
        If no SLA record exists, this is a no-op.
        """
        sla = get_incident_sla(incident)
        if sla is None:
            return None
        if sla.resolution_completed_at is not None:
            # Already completed — idempotent.
            return sla

        sla.resolution_completed_at = timezone.now()
        sla.resolution_breached = False  # Mark as not breached since it completed
        sla.save(
            update_fields=[
                "resolution_completed_at",
                "resolution_breached",
                "updated_at",
            ]
        )
        return sla
