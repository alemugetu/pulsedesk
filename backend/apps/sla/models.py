"""
SLA Policy Engine — Phase 6

Architecture:
  Organization
    └── SLAPolicy (one default per org, multiple policies allowed)
          └── SLATarget (one per priority per policy)

  Incident
    └── IncidentSLA (one-to-one, created at incident creation)

Design decisions:
- IncidentSLA is a dedicated tracking entity rather than inline fields on Incident.
  This keeps the Incident model clean, makes SLA history extensible for future phases,
  and isolates SLA domain concerns from the incident domain.
- A partial unique index enforces only one active-default policy per organization
  at the database level (prevents ambiguous default selection).
- SLA deadlines are calculated server-side using timezone.now() — never client-supplied.
- If no active SLA policy exists for an organization, IncidentSLA is not created
  and the incident is created without an SLA record (graceful degradation).
"""

from typing import ClassVar

from common.models import BaseModel
from django.db import models
from django.db.models import Q
from incidents.models import Incident, IncidentPriority
from organizations.models import Organization


class SLAPolicy(BaseModel):
    """
    An organization-scoped named SLA policy.

    An organization may have multiple policies, but at most one can be both
    active and the default (enforced by a partial unique index).
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="sla_policies",
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
        db_table = "sla_policies"
        verbose_name = "SLA Policy"
        verbose_name_plural = "SLA Policies"
        ordering: ClassVar = ["organization", "name"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_sla_policy_name_per_organization",
            ),
            # Partial unique index: at most one active-default policy per organization.
            # Django translates Q() conditions to the correct boolean syntax for each
            # database engine — TRUE/FALSE on PostgreSQL (Supabase), 1/0 on SQLite
            # (tests). This is the correct cross-engine approach; raw RunSQL with
            # hardcoded boolean literals is engine-specific and was removed.
            models.UniqueConstraint(
                fields=["organization"],
                condition=Q(is_active=True, is_default=True),
                name="unique_active_default_sla_policy_per_org",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "is_default"]),
        ]

    def __str__(self) -> str:
        default_marker = " [default]" if self.is_default else ""
        return f"{self.organization_id} / {self.name}{default_marker}"


class SLATarget(BaseModel):
    """
    Priority-specific response and resolution time targets within an SLA policy.

    Each (policy, priority) pair must be unique — enforced at DB level.
    Times are stored in minutes for straightforward timedelta arithmetic.
    """

    policy = models.ForeignKey(
        SLAPolicy,
        on_delete=models.CASCADE,
        related_name="targets",
    )
    priority = models.CharField(
        max_length=15,
        choices=IncidentPriority.choices,
    )
    response_time_minutes = models.PositiveIntegerField(
        help_text="Minutes until the incident must be acknowledged.",
    )
    resolution_time_minutes = models.PositiveIntegerField(
        help_text="Minutes until the incident must be resolved.",
    )

    class Meta:
        db_table = "sla_targets"
        verbose_name = "SLA Target"
        verbose_name_plural = "SLA Targets"
        ordering: ClassVar = ["policy", "priority"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["policy", "priority"],
                name="unique_sla_target_per_policy_priority",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["policy", "priority"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.policy_id} / {self.priority}: "
            f"response={self.response_time_minutes}m "
            f"resolution={self.resolution_time_minutes}m"
        )


class SLAStatus(models.TextChoices):
    """
    SLA tracking state.

    Design note:
    - ON_TRACK: deadline is in the future and SLA not yet completed.
    - BREACHED: deadline has passed and SLA was not completed in time.
    - COMPLETED: SLA was satisfied before the deadline.

    AT_RISK is explicitly excluded from Phase 6 because it requires a
    configurable threshold (e.g. "80% of time elapsed"). Without that
    configuration, the boundary would be arbitrary. This will be added
    in a future phase when threshold configuration is defined.
    """

    ON_TRACK = "ON_TRACK", "On Track"
    BREACHED = "BREACHED", "Breached"
    COMPLETED = "COMPLETED", "Completed"


class IncidentSLA(BaseModel):
    """
    SLA tracking record for a single incident.

    One-to-one with Incident. Created at incident creation when an active
    default SLA policy exists. Not created if no policy is configured
    (graceful degradation — incident creation never fails due to missing SLA).

    Fields:
      - policy: the SLAPolicy that was active when the incident was created.
      - response_deadline / resolution_deadline: computed server-side at creation.
      - response_breached / resolution_breached: evaluated on read via evaluate_sla_status().
      - response_completed_at: set when OPEN → ACKNOWLEDGED transition occurs.
      - resolution_completed_at: set when IN_PROGRESS → RESOLVED transition occurs.
    """

    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name="sla",
    )
    policy = models.ForeignKey(
        SLAPolicy,
        on_delete=models.PROTECT,
        related_name="incident_slas",
    )
    response_deadline = models.DateTimeField()
    resolution_deadline = models.DateTimeField()
    response_breached = models.BooleanField(default=False)
    resolution_breached = models.BooleanField(default=False)
    response_completed_at = models.DateTimeField(null=True, blank=True)
    resolution_completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "incident_slas"
        verbose_name = "Incident SLA"
        verbose_name_plural = "Incident SLAs"
        indexes: ClassVar = [
            models.Index(fields=["incident"]),
            models.Index(fields=["policy"]),
            models.Index(fields=["response_deadline"]),
            models.Index(fields=["resolution_deadline"]),
        ]

    def __str__(self) -> str:
        return f"SLA for incident {self.incident_id}"
