from typing import ClassVar

from common.models import BaseModel
from django.db import models
from incidents.models import IncidentPriority, IncidentStatus
from organizations.models import Organization


class OrganizationSettings(BaseModel):
    """
    Operational configuration for a single organization.

    One-to-one with Organization. Exists for organization-scoped settings
    that do not belong directly on the Organization identity model (name,
    slug, status).
    """

    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="settings",
    )

    # ── Incident settings ───────────────────────────────────────────────

    default_incident_priority = models.CharField(
        max_length=15,
        choices=IncidentPriority.choices,
        default=IncidentPriority.P3,
        help_text="Default priority assigned to newly created incidents.",
    )
    default_incident_status = models.CharField(
        max_length=20,
        choices=IncidentStatus.choices,
        default=IncidentStatus.OPEN,
        help_text="Default status assigned to newly created incidents.",
    )
    incident_comments_enabled = models.BooleanField(
        default=True,
        help_text="Whether incident comments are enabled for this organization.",
    )

    # ── Notification preferences (organization-level defaults) ──────────

    notification_incident_emails_enabled = models.BooleanField(
        default=True,
        help_text=(
            "Whether incident-related notification emails are sent "
            "to organization members. In-app notifications are unaffected."
        ),
    )
    notification_escalation_emails_enabled = models.BooleanField(
        default=True,
        help_text=(
            "Whether escalation-triggered notification emails are sent. "
            "In-app notifications are unaffected."
        ),
    )
    notification_sla_emails_enabled = models.BooleanField(
        default=True,
        help_text=(
            "Whether SLA warning and breach notification emails are sent. "
            "In-app notifications are unaffected."
        ),
    )

    # ── SLA defaults ────────────────────────────────────────────────────

    sla_auto_apply_default_policy = models.BooleanField(
        default=True,
        help_text=(
            "Whether the organization's default active SLA policy is "
            "automatically applied to newly created incidents."
        ),
    )

    # ── Escalation defaults ─────────────────────────────────────────────

    escalation_auto_apply_default_policy = models.BooleanField(
        default=True,
        help_text=(
            "Whether the organization's default active escalation policy "
            "is automatically evaluated for SLA breaches."
        ),
    )

    class Meta:
        db_table = "organization_settings"
        verbose_name = "Organization Settings"
        verbose_name_plural = "Organization Settings"
        indexes: ClassVar = [
            models.Index(fields=["organization"]),
        ]

    def __str__(self) -> str:
        return f"Settings for {self.organization_id}"
