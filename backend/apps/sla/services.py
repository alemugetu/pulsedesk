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
  - SLAMonitoringService.run()    — Phase 9: cross-org SLA monitoring loop
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from incidents.models import Incident, IncidentPriority, IncidentStatus
from organizations.models import Membership, Organization
from organizations.selectors import user_has_permission
from rest_framework.exceptions import ValidationError
from sla.models import IncidentSLA, SLAPolicy, SLAStatus, SLATarget
from sla.selectors import (
    get_active_incidents_for_sla_monitoring,
    get_default_sla_policy,
    get_incident_sla,
    get_sla_target,
)

logger = logging.getLogger("celery.task")


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


# ---------------------------------------------------------------------------
# SLA monitoring — Phase 9
# ---------------------------------------------------------------------------


@dataclass
class MonitoringResult:
    """
    Structured summary returned by SLAMonitoringService.run().

    Designed to be JSON-serialisable so the Celery task can return it directly.
    Sensitive fields (incident IDs etc.) are counts only — no PII exposed.
    """

    examined: int = 0
    skipped: int = 0  # terminal status or no SLA when re-checked inside the loop
    warnings: int = 0
    breaches: int = 0
    escalations: int = 0
    errors: int = 0

    def to_dict(self) -> dict[str, int]:
        return {
            "examined": self.examined,
            "skipped": self.skipped,
            "warnings": self.warnings,
            "breaches": self.breaches,
            "escalations": self.escalations,
            "errors": self.errors,
        }


# ---------------------------------------------------------------------------
# SLA warning threshold
# ---------------------------------------------------------------------------

#: Default fraction of SLA time elapsed that triggers a warning.
#: 80 % elapsed → warning state.  Configurable per-call; the monitoring
#: service reads it from Django settings at call time.
_DEFAULT_WARNING_THRESHOLD = 0.80


class SLAMonitoringService:
    """
    System-level SLA monitoring service.

    This service is the *only* caller of the authoritative SLA evaluation
    (SLACalculationService) and escalation evaluation
    (EscalationEvaluationService) from within the background task context.

    Design rules:
      - No request context — operates directly on database records.
      - No user authentication — system-level worker.
      - Tenant isolation is enforced by passing each incident's own
        ``incident.organization`` to the org-scoped sub-services.
      - One incident failure never aborts the full monitoring run.
      - All SLA calculation is delegated to SLACalculationService.
      - All escalation logic is delegated to EscalationEvaluationService.
      - Does NOT duplicate breach calculation or escalation rules.
    """

    @staticmethod
    def run(now=None) -> MonitoringResult:
        """
        Execute a full SLA monitoring pass across all eligible incidents.

        Steps per incident:
          1. Re-check status — skip if terminal (may have changed since query).
          2. Retrieve SLA — skip if somehow missing.
          3. Evaluate breach state via authoritative SLA service.
          4. Determine warning state (approaching deadline, not yet breached).
          5. If breached → invoke escalation evaluation for each trigger type.
          6. Accumulate counts; isolate per-incident failures.

        Parameters
        ----------
        now : datetime | None
            Inject a specific datetime for deterministic testing.
            Defaults to ``timezone.now()`` when None.

        Returns
        -------
        MonitoringResult
            Aggregate counts of the monitoring pass.
        """
        if now is None:
            now = timezone.now()

        # Lazy import avoids circular import at module level.
        # SLACalculationService is defined in this same module above.
        from django.conf import settings
        from escalation.models import EscalationTriggerType
        from escalation.services import EscalationEvaluationService

        warning_threshold: float = float(
            getattr(settings, "SLA_WARNING_THRESHOLD", _DEFAULT_WARNING_THRESHOLD)
        )

        result = MonitoringResult()
        start_time = timezone.now()

        logger.info(
            "SLA monitor starting",
            extra={
                "task": "sla.monitor_sla",
                "now": now.isoformat(),
                "warning_threshold": warning_threshold,
            },
        )

        # Retrieve the eligible queryset.  iterator() streams rows from the DB
        # one at a time — avoids loading the entire result set into memory,
        # which keeps memory stable even at high incident volumes.
        qs = get_active_incidents_for_sla_monitoring()

        for incident in qs.iterator(chunk_size=200):
            try:
                processed = SLAMonitoringService._process_incident(
                    incident=incident,
                    now=now,
                    warning_threshold=warning_threshold,
                    escalation_service=EscalationEvaluationService,
                    trigger_types=[
                        EscalationTriggerType.RESPONSE_BREACH,
                        EscalationTriggerType.RESOLUTION_BREACH,
                    ],
                    result=result,
                )
                if not processed:
                    result.skipped += 1
            except Exception:
                result.errors += 1
                logger.exception(
                    "SLA monitor: unhandled error on incident %s (org %s)",
                    incident.pk,
                    incident.organization_id,
                    extra={
                        "task": "sla.monitor_sla",
                        "incident_id": str(incident.pk),
                        "organization_id": str(incident.organization_id),
                    },
                )
                # Continue to next incident — one failure must not abort the run.
                continue

        duration_ms = int((timezone.now() - start_time).total_seconds() * 1000)

        logger.info(
            "SLA monitor completed",
            extra={
                "task": "sla.monitor_sla",
                "examined": result.examined,
                "skipped": result.skipped,
                "warnings": result.warnings,
                "breaches": result.breaches,
                "escalations": result.escalations,
                "errors": result.errors,
                "duration_ms": duration_ms,
            },
        )

        return result

    # ------------------------------------------------------------------
    # Per-incident processing
    # ------------------------------------------------------------------

    @staticmethod
    def _process_incident(
        incident: Incident,
        now,
        warning_threshold: float,
        escalation_service,
        trigger_types: list[str],
        result: MonitoringResult,
    ) -> bool:
        """
        Process a single incident.

        Returns True if the incident was fully evaluated, False if skipped.
        Raises on unexpected errors (caller catches and counts them).
        """
        result.examined += 1

        # 1. Re-verify status inside the processing loop.
        #    The queryset was built before this iteration started; the incident
        #    may have transitioned to RESOLVED/CLOSED in the meantime.
        if incident.status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}:
            logger.debug(
                "SLA monitor: skipping terminal incident %s (status=%s)",
                incident.pk,
                incident.status,
            )
            return False  # Caller will increment skipped

        # 2. Re-fetch SLA inside the loop — it was selected_related so this
        #    accesses the cached attribute without an extra query, but we still
        #    verify it is present.
        sla: IncidentSLA | None = getattr(incident, "sla", None)
        if sla is None:
            logger.debug(
                "SLA monitor: incident %s has no SLA record, skipping.",
                incident.pk,
            )
            return False

        # 3. Evaluate breach state via the authoritative SLA service.
        #    This is the ONLY place we call evaluate_sla_status from the
        #    monitoring path.  It updates response_breached / resolution_breached
        #    on the IncidentSLA record and returns the updated instance.
        sla = SLACalculationService.evaluate_sla_status(sla, now=now)

        # 4. Warning detection — approaching deadline without being breached.
        #    "Warning" means: NOT yet breached, but the deadline is close.
        warning_fired = SLAMonitoringService._check_warning(
            sla=sla, now=now, threshold=warning_threshold
        )
        if warning_fired:
            result.warnings += 1
            logger.info(
                "SLA monitor: SLA warning for incident %s (org %s)",
                incident.pk,
                incident.organization_id,
                extra={
                    "task": "sla.monitor_sla",
                    "incident_id": str(incident.pk),
                    "organization_id": str(incident.organization_id),
                    "event": "sla_warning",
                },
            )

            # Create SLA warning notification
            SLAMonitoringService._create_sla_warning_notification(
                incident=incident,
                sla=sla,
                now=now,
            )

        # 5. Breach → escalation evaluation.
        if sla.response_breached or sla.resolution_breached:
            result.breaches += 1
            logger.info(
                "SLA monitor: SLA breach for incident %s (org %s, "
                "response_breached=%s, resolution_breached=%s)",
                incident.pk,
                incident.organization_id,
                sla.response_breached,
                sla.resolution_breached,
                extra={
                    "task": "sla.monitor_sla",
                    "incident_id": str(incident.pk),
                    "organization_id": str(incident.organization_id),
                    "event": "sla_breach",
                    "response_breached": sla.response_breached,
                    "resolution_breached": sla.resolution_breached,
                },
            )

            # Create SLA breach notification
            SLAMonitoringService._create_sla_breach_notification(
                incident=incident,
                sla=sla,
                now=now,
            )

            # Invoke escalation for each applicable trigger type.
            for trigger_type in trigger_types:
                escalations = SLAMonitoringService._evaluate_escalation(
                    incident=incident,
                    trigger_type=trigger_type,
                    now=now,
                    escalation_service=escalation_service,
                )
                result.escalations += escalations

        return True

    @staticmethod
    def _check_warning(sla: IncidentSLA, now, threshold: float) -> bool:
        """
        Return True if any SLA target is in a warning state.

        Warning criteria (per target):
          - The target has NOT been completed (completed_at is None).
          - The target has NOT yet been breached (breached flag is False).
          - The fraction of elapsed time relative to the total SLA window
            is at or above the configured threshold.

        This does not mark anything in the database — it is a read-only
        assessment used only for logging and result counting.
        """
        warning = False

        # Response warning
        if (
            sla.response_completed_at is None
            and not sla.response_breached
            and SLAMonitoringService._is_approaching(
                created_at=sla.created_at,
                deadline=sla.response_deadline,
                now=now,
                threshold=threshold,
            )
        ):
            warning = True

        # Resolution warning
        if (
            sla.resolution_completed_at is None
            and not sla.resolution_breached
            and SLAMonitoringService._is_approaching(
                created_at=sla.created_at,
                deadline=sla.resolution_deadline,
                now=now,
                threshold=threshold,
            )
        ):
            warning = True

        return warning

    @staticmethod
    def _is_approaching(created_at, deadline, now, threshold: float) -> bool:
        """
        Return True if the fraction of elapsed time ≥ threshold.

        elapsed / total_window >= threshold
        where total_window = deadline - created_at.

        Guards against zero or negative windows (degenerate configuration).
        """
        total_window = (deadline - created_at).total_seconds()
        if total_window <= 0:
            return False  # Degenerate SLA config — treat as not-approaching
        elapsed = (now - created_at).total_seconds()
        if elapsed <= 0:
            return False
        return (elapsed / total_window) >= threshold

    @staticmethod
    def _evaluate_escalation(
        incident: Incident,
        trigger_type: str,
        now,
        escalation_service,
    ) -> int:
        """
        Delegate to the existing escalation evaluation service for one trigger type.

        Returns the number of escalation levels that were newly executed
        (0 if skipped or no new levels due).

        Wraps the call in a per-trigger try/except so that a failure on
        RESPONSE_BREACH does not prevent RESOLUTION_BREACH from being evaluated.
        """
        try:
            eval_result = escalation_service.evaluate_incident_escalation(
                incident=incident,
                trigger_type=trigger_type,
                now=now,
            )
            if not eval_result.was_skipped and eval_result.levels_executed > 0:
                logger.info(
                    "SLA monitor: escalation executed for incident %s "
                    "(org %s, trigger=%s, levels=%d)",
                    incident.pk,
                    incident.organization_id,
                    trigger_type,
                    eval_result.levels_executed,
                    extra={
                        "task": "sla.monitor_sla",
                        "incident_id": str(incident.pk),
                        "organization_id": str(incident.organization_id),
                        "trigger_type": trigger_type,
                        "levels_executed": eval_result.levels_executed,
                        "event": "escalation_executed",
                    },
                )
                return eval_result.levels_executed
            return 0
        except Exception:
            logger.exception(
                "SLA monitor: escalation error for incident %s trigger %s",
                incident.pk,
                trigger_type,
                extra={
                    "task": "sla.monitor_sla",
                    "incident_id": str(incident.pk),
                    "organization_id": str(incident.organization_id),
                    "trigger_type": trigger_type,
                    "event": "escalation_error",
                },
            )
            return 0

    @staticmethod
    def _create_sla_warning_notification(
        incident: Incident,
        sla: IncidentSLA,
        now,
    ) -> None:
        """
        Create SLA warning notification for incident assignee.

        Args:
            incident: The incident with SLA warning
            sla: The incident SLA record
            now: Current timestamp for deadline formatting
        """
        from notifications.services import NotificationService

        # Only notify if there's an assignee
        if not incident.assignee:
            return

        organization = incident.organization
        recipient = incident.assignee.user
        notification_service = NotificationService()

        # Use the appropriate deadline based on which one is approaching
        if sla.response_completed_at is None and not sla.response_breached:
            deadline_str = sla.response_deadline.strftime("%Y-%m-%d %H:%M:%S UTC")
        elif sla.resolution_completed_at is None and not sla.resolution_breached:
            deadline_str = sla.resolution_deadline.strftime("%Y-%m-%d %H:%M:%S UTC")
        else:
            return  # No active deadline to warn about

        try:
            notification_service.create_sla_warning_notification(
                organization=organization,
                recipient=recipient,
                incident_id=str(incident.id),
                incident_title=incident.title,
                deadline_str=deadline_str,
            )
        except Exception:
            # Log error but don't fail the monitoring run
            logger.exception(
                "SLA monitor: failed to create warning notification for incident %s",
                incident.pk,
                extra={
                    "task": "sla.monitor_sla",
                    "incident_id": str(incident.pk),
                    "organization_id": str(incident.organization_id),
                    "event": "notification_error",
                },
            )

    @staticmethod
    def _create_sla_breach_notification(
        incident: Incident,
        sla: IncidentSLA,
        now,
    ) -> None:
        """
        Create SLA breach notification for incident assignee.

        Args:
            incident: The incident with SLA breach
            sla: The incident SLA record
            now: Current timestamp for deadline formatting
        """
        from notifications.services import NotificationService

        # Only notify if there's an assignee
        if not incident.assignee:
            return

        organization = incident.organization
        recipient = incident.assignee.user
        notification_service = NotificationService()

        # Determine which deadline was breached
        if sla.response_breached:
            deadline_str = sla.response_deadline.strftime("%Y-%m-%d %H:%M:%S UTC")
        else:
            deadline_str = sla.resolution_deadline.strftime("%Y-%m-%d %H:%M:%S UTC")

        try:
            notification_service.create_sla_breach_notification(
                organization=organization,
                recipient=recipient,
                incident_id=str(incident.id),
                incident_title=incident.title,
                deadline_str=deadline_str,
            )
        except Exception:
            # Log error but don't fail the monitoring run
            logger.exception(
                "SLA monitor: failed to create breach notification for incident %s",
                incident.pk,
                extra={
                    "task": "sla.monitor_sla",
                    "incident_id": str(incident.pk),
                    "organization_id": str(incident.organization_id),
                    "event": "notification_error",
                },
            )
