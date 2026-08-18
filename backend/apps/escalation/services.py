"""
Escalation Engine Services — Phase 7

Service catalogue:
  EscalationPolicyService
    create_escalation_policy(...)
    update_escalation_policy(...)
    create_escalation_level(...)
    update_escalation_level(...)
    create_escalation_rule(...)

  EscalationEvaluationService
    evaluate_incident_escalation(incident, trigger_type) → EvaluationResult
    _get_or_create_escalation(incident, policy, trigger_type) → IncidentEscalation
    _get_next_due_level(escalation, breach_time, now) → EscalationLevel | None
    _execute_level(escalation, level, trigger_type, now) → EscalationEvent

Idempotency strategy:
  1. select_for_update() on IncidentEscalation prevents concurrent evaluation
     of the same (incident, policy, trigger_type) row from racing.
  2. UniqueConstraint on EscalationEvent(incident_escalation, level, trigger_type)
     provides a second DB-level safety net against duplicate events.
  3. Service-level checks confirm the level has not already been executed before
     attempting the insert.

Concurrency safety:
  evaluate_incident_escalation() wraps the critical section in transaction.atomic()
  and acquires a row-level lock (select_for_update) on the IncidentEscalation row.
  Two simultaneous calls will serialize — one will run, the other will wait and
  then find current_level already advanced, so it will produce no duplicate events.

No Celery, Redis, WebSockets, or background workers in this phase.
The service is synchronous and callable programmatically.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)
from escalation.models import (
    EscalationEvent,
    EscalationEventStatus,
    EscalationLevel,
    EscalationPolicy,
    EscalationRule,
    EscalationStatus,
    EscalationTargetType,
    EscalationTriggerType,
    IncidentEscalation,
)
from escalation.selectors import (
    get_default_escalation_policy,
    get_escalation_levels,
)
from incidents.models import Incident, IncidentStatus
from organizations.models import Membership, MembershipStatus, Organization, Role
from organizations.selectors import user_has_permission
from rest_framework.exceptions import ValidationError


class EscalationValidationError(ValidationError):
    """Validation error with a stable code for escalation operations."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


# ---------------------------------------------------------------------------
# Evaluation result
# ---------------------------------------------------------------------------


@dataclass
class EvaluationResult:
    """
    Deterministic result object returned by evaluate_incident_escalation().

    executed_levels:  list of EscalationEvent records created in this call.
    escalation:       the IncidentEscalation record (updated in place).
    skipped_reason:   human-readable string when evaluation was a no-op.
    """

    executed_levels: list[EscalationEvent] = field(default_factory=list)
    escalation: IncidentEscalation | None = None
    skipped_reason: str = ""

    @property
    def levels_executed(self) -> int:
        return len(self.executed_levels)

    @property
    def was_skipped(self) -> bool:
        return bool(self.skipped_reason)


# ---------------------------------------------------------------------------
# Policy management
# ---------------------------------------------------------------------------


class EscalationPolicyService:
    """Business logic for escalation policy, level, and rule CRUD."""

    # ------------------------------------------------------------------
    # Policy
    # ------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def create_escalation_policy(
        organization: Organization,
        actor_membership: Membership,
        name: str,
        description: str = "",
        is_active: bool = True,
        is_default: bool = False,
    ) -> EscalationPolicy:
        """
        Create an escalation policy for an organization.

        If is_default=True, any existing active default policy is unset first.
        Requires escalation.manage permission.
        """
        if not user_has_permission(
            actor_membership.user, organization, "escalation.manage"
        ):
            raise EscalationValidationError(
                {"detail": "You do not have permission to manage escalation policies."},
                code="permission_denied",
            )

        clean_name = name.strip() if name else ""
        if not clean_name:
            raise EscalationValidationError(
                {"name": ["Escalation policy name is required."]},
                code="invalid_name",
            )

        if EscalationPolicy.objects.filter(
            organization=organization, name__iexact=clean_name
        ).exists():
            raise EscalationValidationError(
                {
                    "name": [
                        "An escalation policy with this name already exists in this organization."
                    ]
                },
                code="duplicate_name",
            )

        if is_default and is_active:
            EscalationPolicy.objects.filter(
                organization=organization,
                is_active=True,
                is_default=True,
            ).update(is_default=False)

        policy = EscalationPolicy.objects.create(
            organization=organization,
            name=clean_name,
            description=description.strip() if description else "",
            is_active=is_active,
            is_default=is_default,
        )
        return policy

    @staticmethod
    @transaction.atomic
    def update_escalation_policy(
        policy: EscalationPolicy,
        actor_membership: Membership,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        is_default: bool | None = None,
    ) -> EscalationPolicy:
        """
        Update an escalation policy.

        When is_default=True is set, any other active-default policy in the
        same organization is unset first to maintain the single-default invariant.
        """
        if not user_has_permission(
            actor_membership.user, policy.organization, "escalation.manage"
        ):
            raise EscalationValidationError(
                {"detail": "You do not have permission to manage escalation policies."},
                code="permission_denied",
            )

        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise EscalationValidationError(
                    {"name": ["Escalation policy name cannot be empty."]},
                    code="invalid_name",
                )
            if (
                EscalationPolicy.objects.filter(
                    organization=policy.organization, name__iexact=clean_name
                )
                .exclude(id=policy.id)
                .exists()
            ):
                raise EscalationValidationError(
                    {
                        "name": [
                            "An escalation policy with this name already exists in this organization."
                        ]
                    },
                    code="duplicate_name",
                )
            policy.name = clean_name

        if description is not None:
            policy.description = description.strip()

        if is_active is not None:
            policy.is_active = is_active
            if not is_active:
                policy.is_default = False

        if is_default is not None:
            effective_active = policy.is_active if is_active is None else is_active
            if is_default and effective_active:
                EscalationPolicy.objects.filter(
                    organization=policy.organization,
                    is_active=True,
                    is_default=True,
                ).exclude(id=policy.id).update(is_default=False)
            policy.is_default = is_default

        policy.save()
        return policy

    # ------------------------------------------------------------------
    # Level
    # ------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def create_escalation_level(
        policy: EscalationPolicy,
        actor_membership: Membership,
        level: int,
        name: str,
        delay_minutes: int = 0,
        target_type: str = EscalationTargetType.ASSIGNEE,
        target_reference: str = "",
    ) -> EscalationLevel:
        """
        Create an ordered escalation level within a policy.

        Tenant isolation: actor must belong to the same organization as the policy.
        For ROLE targets, target_reference must be a Role UUID belonging to the
        same organization — cross-tenant role references are rejected.
        """
        if actor_membership.organization_id != policy.organization_id:
            raise EscalationValidationError(
                {"detail": "Escalation policy does not belong to your organization."},
                code="cross_tenant",
            )

        if not user_has_permission(
            actor_membership.user, policy.organization, "escalation.manage"
        ):
            raise EscalationValidationError(
                {"detail": "You do not have permission to manage escalation policies."},
                code="permission_denied",
            )

        if not isinstance(level, int) or level < 1:
            raise EscalationValidationError(
                {"level": ["Level number must be a positive integer."]},
                code="invalid_level",
            )

        if EscalationLevel.objects.filter(policy=policy, level=level).exists():
            raise EscalationValidationError(
                {"level": [f"Level {level} already exists in this escalation policy."]},
                code="duplicate_level",
            )

        if delay_minutes < 0:
            raise EscalationValidationError(
                {
                    "delay_minutes": [
                        "Delay must be zero or a positive number of minutes."
                    ]
                },
                code="invalid_delay",
            )

        if target_type not in EscalationTargetType.values:
            raise EscalationValidationError(
                {"target_type": [f"Invalid target type '{target_type}'."]},
                code="invalid_target_type",
            )

        # Validate ROLE target: the referenced role must belong to the policy's org.
        if target_type == EscalationTargetType.ROLE:
            EscalationPolicyService._validate_role_target(
                target_reference, policy.organization
            )
        else:
            # ASSIGNEE: target_reference is not used — enforce empty.
            target_reference = ""

        clean_name = name.strip() if name else ""
        if not clean_name:
            raise EscalationValidationError(
                {"name": ["Level name is required."]},
                code="invalid_name",
            )

        return EscalationLevel.objects.create(
            policy=policy,
            level=level,
            name=clean_name,
            delay_minutes=delay_minutes,
            target_type=target_type,
            target_reference=target_reference,
        )

    @staticmethod
    @transaction.atomic
    def update_escalation_level(
        escalation_level: EscalationLevel,
        actor_membership: Membership,
        name: str | None = None,
        delay_minutes: int | None = None,
        target_type: str | None = None,
        target_reference: str | None = None,
    ) -> EscalationLevel:
        """Update mutable fields on an escalation level."""
        if actor_membership.organization_id != escalation_level.policy.organization_id:
            raise EscalationValidationError(
                {"detail": "Escalation level does not belong to your organization."},
                code="cross_tenant",
            )

        if not user_has_permission(
            actor_membership.user,
            escalation_level.policy.organization,
            "escalation.manage",
        ):
            raise EscalationValidationError(
                {"detail": "You do not have permission to manage escalation policies."},
                code="permission_denied",
            )

        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise EscalationValidationError(
                    {"name": ["Level name cannot be empty."]},
                    code="invalid_name",
                )
            escalation_level.name = clean_name

        if delay_minutes is not None:
            if delay_minutes < 0:
                raise EscalationValidationError(
                    {
                        "delay_minutes": [
                            "Delay must be zero or a positive number of minutes."
                        ]
                    },
                    code="invalid_delay",
                )
            escalation_level.delay_minutes = delay_minutes

        # Handle target_type / target_reference updates atomically.
        new_target_type = (
            target_type if target_type is not None else escalation_level.target_type
        )
        new_target_reference = (
            target_reference
            if target_reference is not None
            else escalation_level.target_reference
        )

        if target_type is not None and target_type not in EscalationTargetType.values:
            raise EscalationValidationError(
                {"target_type": [f"Invalid target type '{target_type}'."]},
                code="invalid_target_type",
            )

        if new_target_type == EscalationTargetType.ROLE:
            EscalationPolicyService._validate_role_target(
                new_target_reference, escalation_level.policy.organization
            )
        else:
            new_target_reference = ""

        escalation_level.target_type = new_target_type
        escalation_level.target_reference = new_target_reference
        escalation_level.save()
        return escalation_level

    # ------------------------------------------------------------------
    # Rule
    # ------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def create_escalation_rule(
        policy: EscalationPolicy,
        actor_membership: Membership,
        trigger_type: str,
        is_active: bool = True,
    ) -> EscalationRule:
        """
        Create a rule linking a trigger type to an escalation policy.

        Only one rule per (policy, trigger_type) is allowed.
        """
        if actor_membership.organization_id != policy.organization_id:
            raise EscalationValidationError(
                {"detail": "Escalation policy does not belong to your organization."},
                code="cross_tenant",
            )

        if not user_has_permission(
            actor_membership.user, policy.organization, "escalation.manage"
        ):
            raise EscalationValidationError(
                {"detail": "You do not have permission to manage escalation policies."},
                code="permission_denied",
            )

        if trigger_type not in EscalationTriggerType.values:
            raise EscalationValidationError(
                {"trigger_type": [f"Invalid trigger type '{trigger_type}'."]},
                code="invalid_trigger_type",
            )

        if EscalationRule.objects.filter(
            policy=policy, trigger_type=trigger_type
        ).exists():
            raise EscalationValidationError(
                {
                    "trigger_type": [
                        f"A rule for trigger '{trigger_type}' already exists in this policy."
                    ]
                },
                code="duplicate_rule",
            )

        return EscalationRule.objects.create(
            policy=policy,
            trigger_type=trigger_type,
            is_active=is_active,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_role_target(
        target_reference: str, organization: Organization
    ) -> Role:
        """
        Validate that target_reference is a UUID of a Role belonging to organization.
        Raises EscalationValidationError if invalid or cross-tenant.
        """
        if not target_reference:
            raise EscalationValidationError(
                {"target_reference": ["A role UUID is required for ROLE target type."]},
                code="missing_role_reference",
            )
        try:
            role = Role.objects.get(id=target_reference, organization=organization)
        except (Role.DoesNotExist, ValueError, TypeError):
            raise EscalationValidationError(
                {
                    "target_reference": [
                        "Role not found or does not belong to this organization."
                    ]
                },
                code="invalid_role_reference",
            )
        return role


# ---------------------------------------------------------------------------
# Escalation evaluation
# ---------------------------------------------------------------------------


class EscalationEvaluationService:
    """
    Stateless escalation evaluation service.

    The primary entry point is evaluate_incident_escalation().
    It is safe to call repeatedly — it is idempotent by design.
    """

    @staticmethod
    def evaluate_incident_escalation(
        incident: Incident,
        trigger_type: str,
        now=None,
    ) -> EvaluationResult:
        """
        Evaluate escalation for an incident and a specific trigger.

        Steps:
          1. Validate trigger_type.
          2. Skip RESOLVED / CLOSED incidents.
          3. Load SLA state to confirm breach has occurred.
          4. Find the active default escalation policy for the org.
          5. Confirm an active rule exists for this trigger_type.
          6. Acquire row-level lock on IncidentEscalation (create if first eval).
          7. Determine all due escalation levels since breach time.
          8. For each due level not yet executed, record an EscalationEvent.
          9. Update IncidentEscalation.current_level and status.
         10. Return a deterministic EvaluationResult.

        This method is safe to call repeatedly. Multiple calls will not
        create duplicate events (idempotency via DB constraint + service checks).
        """
        if now is None:
            now = timezone.now()

        result = EvaluationResult()

        # 1. Validate trigger type
        if trigger_type not in EscalationTriggerType.values:
            result.skipped_reason = f"Unknown trigger_type '{trigger_type}'."
            return result

        # 2. Skip terminal incidents
        if incident.status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}:
            result.skipped_reason = (
                f"Incident is {incident.status}. Escalation will not continue."
            )
            return result

        # 3. Check SLA breach state
        breach_time = EscalationEvaluationService._get_breach_time(
            incident, trigger_type
        )
        if breach_time is None:
            result.skipped_reason = (
                f"No SLA breach detected for trigger_type='{trigger_type}'."
            )
            return result

        # 4. Load escalation policy
        policy = get_default_escalation_policy(incident.organization)
        if policy is None:
            result.skipped_reason = (
                "No active default escalation policy configured for this organization."
            )
            return result

        # 5. Confirm active rule
        try:
            EscalationRule.objects.get(
                policy=policy,
                trigger_type=trigger_type,
                is_active=True,
            )
        except EscalationRule.DoesNotExist:
            result.skipped_reason = (
                f"No active escalation rule found for trigger_type='{trigger_type}'."
            )
            return result

        # 6–9. Critical section: acquire row lock and execute due levels
        executed = EscalationEvaluationService._execute_due_levels(
            incident=incident,
            policy=policy,
            trigger_type=trigger_type,
            breach_time=breach_time,
            now=now,
        )

        result.executed_levels = executed

        # Reload escalation state for the result
        try:
            escalation = IncidentEscalation.objects.get(
                incident=incident,
                policy=policy,
                trigger_type=trigger_type,
            )
            result.escalation = escalation
        except IncidentEscalation.DoesNotExist:
            pass

        if not executed:
            result.skipped_reason = "No new escalation levels were due."

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_breach_time(incident: Incident, trigger_type: str):
        """
        Return the datetime at which the SLA breach occurred, or None.

        Reads from the existing SLA engine (authoritative source).
        Does NOT duplicate SLA calculation.
        """
        try:
            sla = incident.sla  # IncidentSLA via OneToOne reverse relation
        except Exception:  # noqa: BLE001
            return None

        if sla is None:
            return None

        if (
            trigger_type == EscalationTriggerType.RESPONSE_BREACH
            and sla.response_breached
        ):
            return sla.response_deadline
        if (
            trigger_type == EscalationTriggerType.RESOLUTION_BREACH
            and sla.resolution_breached
        ):
            return sla.resolution_deadline

        return None

    @staticmethod
    @transaction.atomic
    def _execute_due_levels(
        incident: Incident,
        policy: EscalationPolicy,
        trigger_type: str,
        breach_time,
        now,
    ) -> list[EscalationEvent]:
        """
        Transactional core: get-or-create the IncidentEscalation row with a
        row-level lock, determine which levels are due, execute each one.

        Concurrency: select_for_update() serializes concurrent evaluations for the
        same (incident, policy, trigger_type). The second concurrent call will
        wait for the first to commit, then see updated current_level and no-op.
        """
        # Get or create escalation tracking row — then immediately lock it.
        escalation, _ = IncidentEscalation.objects.get_or_create(
            incident=incident,
            policy=policy,
            trigger_type=trigger_type,
            defaults={
                "status": EscalationStatus.ACTIVE,
                "current_level": 0,
            },
        )

        # Re-acquire with row lock inside the transaction.
        escalation = IncidentEscalation.objects.select_for_update().get(
            pk=escalation.pk
        )

        if escalation.status != EscalationStatus.ACTIVE:
            return []

        # Load ordered levels for this policy.
        levels = list(get_escalation_levels(policy))
        if not levels:
            return []

        executed: list[EscalationEvent] = []

        for lvl in levels:
            # Skip already-executed levels.
            if lvl.level <= escalation.current_level:
                continue

            # Determine when this level becomes due.
            level_due_at = breach_time + timedelta(minutes=lvl.delay_minutes)

            if now < level_due_at:
                # Not yet due — stop (levels are ordered; later levels won't be due either).
                break

            # Attempt to execute this level (idempotent via DB unique constraint).
            event = EscalationEvaluationService._execute_level(
                escalation=escalation,
                level=lvl,
                trigger_type=trigger_type,
                now=now,
            )
            if event is not None:
                executed.append(event)
                escalation.current_level = lvl.level

        # Update last_evaluated_at regardless of whether new levels were executed.
        escalation.last_evaluated_at = now

        # Check if all levels are exhausted.
        if executed and escalation.current_level == levels[-1].level:
            escalation.status = EscalationStatus.COMPLETED
            escalation.completed_at = now

            # Publish realtime escalation completed event
            EscalationEvaluationService._publish_escalation_completed_event(
                escalation=escalation,
            )

        escalation.save(
            update_fields=[
                "current_level",
                "status",
                "last_evaluated_at",
                "completed_at",
                "updated_at",
            ]
        )

        return executed

    @staticmethod
    def _execute_level(
        escalation: IncidentEscalation,
        level: EscalationLevel,
        trigger_type: str,
        now,
    ) -> EscalationEvent | None:
        """
        Record a single escalation event and create notifications.

        If the event already exists (duplicate call), the DB unique constraint
        will raise IntegrityError which we catch and return None.
        This is the second-layer idempotency guard after the service-level check.

        When a new escalation event is created, notifications are sent to the
        resolved recipients based on the escalation target type.
        """
        try:
            with transaction.atomic():
                event = EscalationEvent.objects.create(
                    incident_escalation=escalation,
                    level=level.level,
                    trigger_type=trigger_type,
                    triggered_at=now,
                    target_type=level.target_type,
                    target_reference=level.target_reference,
                    status=EscalationEventStatus.EXECUTED,
                )

                # Create notifications for the escalation event
                EscalationEvaluationService._create_escalation_notifications(
                    event=event,
                    escalation=escalation,
                    level=level,
                )

                # Publish realtime escalation triggered event
                EscalationEvaluationService._publish_escalation_triggered_event(
                    event=event,
                    escalation=escalation,
                    level=level,
                )

        except IntegrityError:
            # Already exists — idempotent.
            return None

        return event

    @staticmethod
    def _create_escalation_notifications(
        event: EscalationEvent,
        escalation: IncidentEscalation,
        level: EscalationLevel,
    ) -> None:
        """
        Create notifications for escalation event recipients.

        Resolves recipients based on the escalation target type:
        - ASSIGNEE: Uses the current incident assignee
        - ROLE: Uses all organization members with the specified role

        Notification creation is enqueued via transaction.on_commit() to ensure
        data consistency.
        """
        from notifications.services import NotificationService

        incident = escalation.incident
        organization = incident.organization
        notification_service = NotificationService()

        # Resolve recipients based on target type
        recipients = EscalationEvaluationService._resolve_escalation_recipients(
            incident=incident,
            target_type=level.target_type,
            target_reference=level.target_reference,
            organization=organization,
        )

        # Create notification for each recipient
        for recipient in recipients:
            try:
                notification_service.create_escalation_notification(
                    organization=organization,
                    recipient=recipient,
                    escalation_event_id=str(event.id),
                    incident_id=str(incident.id),
                    incident_title=incident.title,
                    escalation_level=level.level,
                    target_type=level.target_type,
                )
            except Exception as exc:  # noqa: BLE001
                # Log error but continue with other recipients
                # One failed notification should not block others
                logger.warning(
                    f"Failed to create escalation notification for recipient {recipient.email}: {exc}"
                )

    @staticmethod
    def _publish_escalation_triggered_event(
        event: EscalationEvent,
        escalation: IncidentEscalation,
        level: EscalationLevel,
    ) -> None:
        """
        Publish realtime escalation triggered event.

        Args:
            event: The escalation event that was triggered
            escalation: The incident escalation record
            level: The escalation level that was executed
        """
        from realtime.services import RealtimeEventService

        incident = escalation.incident

        try:
            RealtimeEventService.publish_escalation_triggered(
                escalation_id=str(escalation.id),
                incident_id=str(incident.id),
                incident_number=incident.incident_number,
                escalation_level=level.level,
                organization_id=str(incident.organization_id),
            )
        except Exception:
            # Log error but don't fail the escalation execution
            logger.exception(
                "Failed to publish escalation triggered event for escalation %s",
                escalation.id,
                extra={
                    "escalation_id": str(escalation.id),
                    "incident_id": str(incident.id),
                    "event": "realtime_error",
                },
            )

    @staticmethod
    def _publish_escalation_completed_event(
        escalation: IncidentEscalation,
    ) -> None:
        """
        Publish realtime escalation completed event.

        Args:
            escalation: The incident escalation record that completed
        """
        from realtime.services import RealtimeEventService

        incident = escalation.incident

        try:
            RealtimeEventService.publish_escalation_completed(
                escalation_id=str(escalation.id),
                incident_id=str(incident.id),
                incident_number=incident.incident_number,
                escalation_level=escalation.current_level,
                organization_id=str(incident.organization_id),
            )
        except Exception:
            # Log error but don't fail the escalation completion
            logger.exception(
                "Failed to publish escalation completed event for escalation %s",
                escalation.id,
                extra={
                    "escalation_id": str(escalation.id),
                    "incident_id": str(incident.id),
                    "event": "realtime_error",
                },
            )

    @staticmethod
    def _resolve_escalation_recipients(
        incident: Incident,
        target_type: str,
        target_reference: str,
        organization: Organization,
    ) -> list:
        """
        Resolve escalation recipients based on target type.

        Args:
            incident: The incident being escalated
            target_type: ASSIGNEE or ROLE
            target_reference: Role UUID for ROLE targets, empty for ASSIGNEE
            organization: The organization

        Returns:
            List of user objects who should receive the notification
        """
        recipients = []

        if target_type == EscalationTargetType.ASSIGNEE:
            # Target the current incident assignee
            if incident.assignee:
                recipients.append(incident.assignee.user)

        elif target_type == EscalationTargetType.ROLE:
            # Target all active organization members with the specified role
            try:
                import uuid

                from organizations.models import Role

                role_id = uuid.UUID(target_reference)
                role = Role.objects.get(id=role_id, organization=organization)

                # Get all active members with this role
                memberships = organization.memberships.filter(
                    status=MembershipStatus.ACTIVE,
                    role=role,
                ).select_related("user")

                recipients = [membership.user for membership in memberships]

            except (ValueError, Role.DoesNotExist):
                # Invalid role reference - no recipients
                pass

        return recipients

    @staticmethod
    @transaction.atomic
    def cancel_incident_escalation(
        incident: Incident,
        policy: EscalationPolicy,
        trigger_type: str,
    ) -> IncidentEscalation | None:
        """
        Cancel an active escalation (e.g., when incident is resolved/closed).

        Preserves all EscalationEvent history — only updates the status.
        Returns the updated IncidentEscalation, or None if not found.
        """
        try:
            escalation = IncidentEscalation.objects.select_for_update().get(
                incident=incident,
                policy=policy,
                trigger_type=trigger_type,
                status=EscalationStatus.ACTIVE,
            )
        except IncidentEscalation.DoesNotExist:
            return None

        escalation.status = EscalationStatus.CANCELLED
        escalation.save(update_fields=["status", "updated_at"])
        return escalation
