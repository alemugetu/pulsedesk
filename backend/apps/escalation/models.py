"""
Escalation Engine — Phase 7

Domain architecture:
  Organization
    └── EscalationPolicy (one default per org, multiple allowed)
          ├── EscalationLevel  (ordered, delay-based; target = ASSIGNEE | ROLE)
          └── EscalationRule   (trigger type: RESPONSE_BREACH | RESOLUTION_BREACH)

  Incident
    └── IncidentEscalation  (active escalation tracking; one per incident per policy)
          └── EscalationEvent (immutable history record per level execution)

Design decisions:
- EscalationPolicy mirrors SLAPolicy's org-scoping and single-default pattern.
- EscalationLevel stores a (target_type, target_reference) pair. For ROLE targets,
  target_reference holds the Role UUID. For ASSIGNEE targets, it is empty (the
  current incident assignee is resolved at evaluation time).
- Idempotency is enforced by a UniqueConstraint on
  (incident_escalation, level, trigger_type) for EscalationEvent — prevents
  duplicate events at the DB level even under concurrent evaluation.
- select_for_update() on IncidentEscalation during evaluation prevents concurrent
  evaluations from racing.
- EscalationEvent records are never deleted — they form the audit trail.
- No Celery, Redis, WebSockets, or background workers in this phase.
  evaluate_incident_escalation() is a synchronous, callable service.
"""

from typing import ClassVar

from common.models import BaseModel
from django.db import models
from django.db.models import Q
from incidents.models import Incident
from organizations.models import Organization

# ---------------------------------------------------------------------------
# Choices
# ---------------------------------------------------------------------------


class EscalationTargetType(models.TextChoices):
    ASSIGNEE = "ASSIGNEE", "Assigned Agent"
    ROLE = "ROLE", "Organization Role"


class EscalationTriggerType(models.TextChoices):
    RESPONSE_BREACH = "RESPONSE_BREACH", "Response SLA Breach"
    RESOLUTION_BREACH = "RESOLUTION_BREACH", "Resolution SLA Breach"


class EscalationStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class EscalationEventStatus(models.TextChoices):
    EXECUTED = "EXECUTED", "Executed"


# ---------------------------------------------------------------------------
# EscalationPolicy
# ---------------------------------------------------------------------------


class EscalationPolicy(BaseModel):
    """
    An organization-scoped named escalation policy.

    At most one active-default policy per organization is allowed
    (enforced by a partial unique index, mirroring SLAPolicy).
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="escalation_policies",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text=(
            "Only one active policy per organization may be the default. "
            "Enforced by a partial unique index."
        ),
    )

    class Meta:
        db_table = "escalation_policies"
        verbose_name = "Escalation Policy"
        verbose_name_plural = "Escalation Policies"
        ordering: ClassVar = ["organization", "name"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_escalation_policy_name_per_organization",
            ),
            models.UniqueConstraint(
                fields=["organization"],
                condition=Q(is_active=True, is_default=True),
                name="unique_active_default_escalation_policy_per_org",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "is_default"]),
        ]

    def __str__(self) -> str:
        marker = " [default]" if self.is_default else ""
        return f"{self.organization_id} / {self.name}{marker}"


# ---------------------------------------------------------------------------
# EscalationLevel
# ---------------------------------------------------------------------------


class EscalationLevel(BaseModel):
    """
    An ordered escalation step within a policy.

    - level: positive integer, must be unique per policy; defines execution order.
    - delay_minutes: minutes after the breach event before this level is due.
      Level 1 typically has delay=0 (immediate). Subsequent levels add wait time.
    - target_type: ASSIGNEE or ROLE.
    - target_reference: for ROLE, the Role UUID as a string; empty for ASSIGNEE.
      Stored as CharField (not FK) to keep schema simple while still being
      validated at the service layer against the organization's roles.
    """

    policy = models.ForeignKey(
        EscalationPolicy,
        on_delete=models.CASCADE,
        related_name="levels",
    )
    level = models.PositiveIntegerField(
        help_text="Execution order within the policy. Must be unique per policy.",
    )
    name = models.CharField(max_length=255)
    delay_minutes = models.PositiveIntegerField(
        default=0,
        help_text="Minutes after the breach trigger before this level becomes due.",
    )
    target_type = models.CharField(
        max_length=20,
        choices=EscalationTargetType.choices,
    )
    target_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text=(
            "For ROLE targets: the Role UUID. "
            "For ASSIGNEE targets: empty (resolved at evaluation time)."
        ),
    )

    class Meta:
        db_table = "escalation_levels"
        verbose_name = "Escalation Level"
        verbose_name_plural = "Escalation Levels"
        ordering: ClassVar = ["policy", "level"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["policy", "level"],
                name="unique_escalation_level_per_policy",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["policy", "level"]),
        ]

    def __str__(self) -> str:
        return f"{self.policy_id} / Level {self.level}: {self.name}"


# ---------------------------------------------------------------------------
# EscalationRule
# ---------------------------------------------------------------------------


class EscalationRule(BaseModel):
    """
    Maps a trigger condition to an escalation policy.

    When a trigger fires (e.g., RESPONSE_BREACH), the evaluation service
    looks up the active rule for the policy and begins executing levels.
    A policy can have multiple rules (one per trigger type), but cannot have
    two rules for the same trigger within the same policy.
    """

    policy = models.ForeignKey(
        EscalationPolicy,
        on_delete=models.CASCADE,
        related_name="rules",
    )
    trigger_type = models.CharField(
        max_length=30,
        choices=EscalationTriggerType.choices,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "escalation_rules"
        verbose_name = "Escalation Rule"
        verbose_name_plural = "Escalation Rules"
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["policy", "trigger_type"],
                name="unique_escalation_rule_per_policy_trigger",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["policy", "trigger_type"]),
        ]

    def __str__(self) -> str:
        return f"{self.policy_id} / {self.trigger_type}"


# ---------------------------------------------------------------------------
# IncidentEscalation
# ---------------------------------------------------------------------------


class IncidentEscalation(BaseModel):
    """
    Per-incident escalation state tracking.

    One record per (incident, policy) pair. Tracks which level is currently
    active and whether escalation is still running. Row-level locking via
    select_for_update() in the evaluation service prevents concurrent races.
    """

    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name="escalations",
    )
    policy = models.ForeignKey(
        EscalationPolicy,
        on_delete=models.PROTECT,
        related_name="incident_escalations",
    )
    trigger_type = models.CharField(
        max_length=30,
        choices=EscalationTriggerType.choices,
    )
    current_level = models.PositiveIntegerField(
        default=0,
        help_text="The level number of the last executed escalation level (0 = none yet).",
    )
    status = models.CharField(
        max_length=20,
        choices=EscalationStatus.choices,
        default=EscalationStatus.ACTIVE,
    )
    started_at = models.DateTimeField(auto_now_add=True)
    last_evaluated_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "incident_escalations"
        verbose_name = "Incident Escalation"
        verbose_name_plural = "Incident Escalations"
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["incident", "policy", "trigger_type"],
                name="unique_incident_escalation_per_policy_trigger",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["incident"]),
            models.Index(fields=["policy"]),
            models.Index(fields=["status"]),
            models.Index(fields=["incident", "status"]),
        ]

    def __str__(self) -> str:
        return (
            f"Escalation for {self.incident_id} "
            f"(policy={self.policy_id}, trigger={self.trigger_type}, "
            f"level={self.current_level}, status={self.status})"
        )


# ---------------------------------------------------------------------------
# EscalationEvent
# ---------------------------------------------------------------------------


class EscalationEvent(BaseModel):
    """
    Immutable historical record of a single escalation level execution.

    The UniqueConstraint on (incident_escalation, level, trigger_type) is the
    primary idempotency guard at the database level. Even if two concurrent
    evaluation calls reach the insert simultaneously (after select_for_update
    has prevented double execution), only one will succeed.

    Records are never deleted — they form the escalation audit trail.
    """

    incident_escalation = models.ForeignKey(
        IncidentEscalation,
        on_delete=models.CASCADE,
        related_name="events",
    )
    level = models.PositiveIntegerField(
        help_text="The escalation level number that was executed.",
    )
    trigger_type = models.CharField(
        max_length=30,
        choices=EscalationTriggerType.choices,
    )
    triggered_at = models.DateTimeField()
    target_type = models.CharField(
        max_length=20,
        choices=EscalationTargetType.choices,
    )
    target_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Snapshot of the target at execution time (role UUID or 'assignee').",
    )
    status = models.CharField(
        max_length=20,
        choices=EscalationEventStatus.choices,
        default=EscalationEventStatus.EXECUTED,
    )

    class Meta:
        db_table = "escalation_events"
        verbose_name = "Escalation Event"
        verbose_name_plural = "Escalation Events"
        ordering: ClassVar = ["triggered_at", "level"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["incident_escalation", "level", "trigger_type"],
                name="unique_escalation_event_per_level_trigger",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["incident_escalation"]),
            models.Index(fields=["incident_escalation", "level"]),
            models.Index(fields=["triggered_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"EscalationEvent(escalation={self.incident_escalation_id}, "
            f"level={self.level}, trigger={self.trigger_type})"
        )
