"""
AuditLog — immutable audit record model for PulseDesk.

Design principles:
- Append-only: records are never updated or deleted through the application.
- Tenant-isolated: every record has an organization FK.
- Actor-tracked: actor (user) FK is nullable for system-generated events.
- Resource-identified: resource_type + resource_id identify the affected object.
- Safe metadata: changes stored as JSONField with no passwords, tokens or secrets.
- Stable action identifiers: machine-readable dot-notation strings.
- Indexed for practical query patterns (org+timestamp, org+action, resource).

Immutability is enforced at three levels:
1. No UPDATE endpoint exists in the API.
2. No service method exists to update records.
3. `save()` override blocks any attempt to update an existing record
   (defence-in-depth against accidental code paths).
"""

from typing import ClassVar

from common.models import BaseModel
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from organizations.models import Organization


class AuditAction(models.TextChoices):
    """
    Stable, machine-readable action identifiers.

    Follows the <resource>.<verb> convention to match existing RBAC codenames
    and realtime event naming in PulseDesk.
    """

    # ── Incidents ──────────────────────────────────────────────────────
    INCIDENT_CREATED = "incident.created", "Incident Created"
    INCIDENT_UPDATED = "incident.updated", "Incident Updated"
    INCIDENT_STATUS_CHANGED = "incident.status_changed", "Incident Status Changed"
    INCIDENT_PRIORITY_CHANGED = "incident.priority_changed", "Incident Priority Changed"
    INCIDENT_ASSIGNED = "incident.assigned", "Incident Assigned"
    INCIDENT_RESOLVED = "incident.resolved", "Incident Resolved"
    INCIDENT_CLOSED = "incident.closed", "Incident Closed"

    # ── Comments ───────────────────────────────────────────────────────
    COMMENT_CREATED = "comment.created", "Comment Created"
    COMMENT_UPDATED = "comment.updated", "Comment Updated"
    COMMENT_DELETED = "comment.deleted", "Comment Deleted"

    # ── Attachments ────────────────────────────────────────────────────
    ATTACHMENT_UPLOADED = "attachment.uploaded", "Attachment Uploaded"
    ATTACHMENT_DELETED = "attachment.deleted", "Attachment Deleted"

    # ── Organization members ───────────────────────────────────────────
    MEMBER_ADDED = "member.added", "Member Added"
    MEMBER_SUSPENDED = "member.suspended", "Member Suspended"
    MEMBER_REMOVED = "member.removed", "Member Removed"

    # ── Roles ──────────────────────────────────────────────────────────
    ROLE_CREATED = "role.created", "Role Created"
    ROLE_UPDATED = "role.updated", "Role Updated"
    ROLE_DELETED = "role.deleted", "Role Deleted"
    ROLE_ASSIGNED = "role.assigned", "Role Assigned"

    # ── SLA ────────────────────────────────────────────────────────────
    SLA_POLICY_CREATED = "sla_policy.created", "SLA Policy Created"
    SLA_POLICY_UPDATED = "sla_policy.updated", "SLA Policy Updated"
    SLA_TARGET_CREATED = "sla_target.created", "SLA Target Created"
    SLA_TARGET_UPDATED = "sla_target.updated", "SLA Target Updated"
    SLA_BREACHED = "sla.breached", "SLA Breached"

    # ── Escalation ─────────────────────────────────────────────────────
    ESCALATION_POLICY_CREATED = "escalation_policy.created", "Escalation Policy Created"
    ESCALATION_POLICY_UPDATED = "escalation_policy.updated", "Escalation Policy Updated"
    ESCALATION_TRIGGERED = "escalation.triggered", "Escalation Triggered"

    # ── Settings (Phase 13.6) ──────────────────────────────────────────
    SETTINGS_UPDATED = "settings.updated", "Organization Settings Updated"


class AuditLog(BaseModel):
    """
    Immutable audit record for a meaningful business or security event.

    Fields
    ------
    organization    Tenant owner — never null.
    actor           User who performed the action.  Null for system events
                    (SLA monitor, escalation engine).
    action          Stable dot-notation identifier from AuditAction.
    resource_type   Class/entity name of the affected resource, e.g. "incident".
    resource_id     UUID of the affected resource (stored as string for
                    flexibility — some resources use non-UUID PKs).
    changes         JSONField with safe before/after context (no secrets).
    ip_address      Client IP at the time of the action (may be null).
    created_at      Inherited from BaseModel.  This is the immutable timestamp.

    Note: `updated_at` is inherited from BaseModel but will always equal
    `created_at` because the save() override blocks any mutation.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        help_text="Organization that owns this audit record.",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        help_text=(
            "User who performed the action. "
            "Null for system-generated events (SLA monitor, escalation engine)."
        ),
    )
    action = models.CharField(
        max_length=80,
        choices=AuditAction.choices,
        db_index=True,
        help_text="Stable dot-notation action identifier.",
    )
    resource_type = models.CharField(
        max_length=80,
        db_index=True,
        help_text="Class/entity type of the affected resource, e.g. 'incident'.",
    )
    resource_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="String representation of the affected resource's primary key.",
    )
    changes = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Safe contextual metadata: before/after values, labels. "
            "Must never contain passwords, tokens, or secrets."
        ),
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Client IP address at the time of the action.",
    )

    class Meta:
        db_table = "audit_logs"
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        # Newest first — the natural read pattern for audit UIs.
        ordering: ClassVar = ["-created_at"]
        indexes: ClassVar = [
            # Primary read pattern: list all events for an organization, newest first.
            models.Index(
                fields=["organization", "-created_at"],
                name="audit_org_created_idx",
            ),
            # Filter by action within an org (e.g. "show me all incident.created events").
            models.Index(
                fields=["organization", "action"],
                name="audit_org_action_idx",
            ),
            # Resource history: "what happened to incident X?"
            models.Index(
                fields=["organization", "resource_type", "resource_id"],
                name="audit_org_resource_idx",
            ),
            # Actor history: "what did user Y do in this org?"
            models.Index(
                fields=["organization", "actor"],
                name="audit_org_actor_idx",
            ),
        ]

    def __str__(self) -> str:
        actor_label = self.actor.email if self.actor else "system"
        return f"[{self.action}] {actor_label} @ {self.organization_id} ({self.created_at})"

    # -----------------------------------------------------------------------
    # Immutability guard
    # -----------------------------------------------------------------------

    def save(self, *args, **kwargs):
        """
        Block any attempt to UPDATE an existing audit record.

        New records (self._state.adding is True) are allowed.
        Any call on an already-persisted record raises ValidationError.
        This is defence-in-depth — the API and service layer never expose
        update paths, but this guard catches accidental code-level mutations.
        """
        if not self._state.adding:
            raise ValidationError(
                "AuditLog records are immutable and cannot be modified."
            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Block programmatic deletion of audit records.

        Only direct database admin access should ever delete audit logs.
        """
        raise ValidationError(
            "AuditLog records are immutable and cannot be deleted through the application."
        )
