from django.db import transaction
from incidents.models import IncidentPriority, IncidentStatus
from organizations.models import Organization
from settings.models import OrganizationSettings


_SETTINGS_FIELDS = (
    "default_incident_priority",
    "default_incident_status",
    "incident_comments_enabled",
    "notification_incident_emails_enabled",
    "notification_escalation_emails_enabled",
    "notification_sla_emails_enabled",
    "sla_auto_apply_default_policy",
    "escalation_auto_apply_default_policy",
)


_VALID_PRIORITIES = {v for v, _ in IncidentPriority.choices}
_VALID_STATUSES = {v for v, _ in IncidentStatus.choices}
_PRIORITY_MAXLEN = 2
_STATUS_MAXLEN = 16


class OrganizationSettingsService:
    """Business logic for organization settings."""

    @staticmethod
    @transaction.atomic
    def create_default_settings(organization: Organization) -> OrganizationSettings:
        """
        Create a default OrganizationSettings record for a new organization.

        Safe to call on organizations that already have settings (returns
        the existing record). Used by the organization-creation service
        and by data migrations that backfill legacy organizations.
        """
        settings, _created = OrganizationSettings.objects.get_or_create(
            organization=organization,
            defaults={
                "default_incident_priority": IncidentPriority.P3,
                "default_incident_status": IncidentStatus.OPEN,
                "incident_comments_enabled": True,
                "notification_incident_emails_enabled": True,
                "notification_escalation_emails_enabled": True,
                "notification_sla_emails_enabled": True,
                "sla_auto_apply_default_policy": True,
                "escalation_auto_apply_default_policy": True,
            },
        )
        return settings

    @staticmethod
    def _validate_update_value(field: str, value):
        """
        Defence-in-depth validator for a single settings value.

        The serializer boundary is the primary validator; this method
        provides a second layer so that direct service callers (tests,
        admin, future consumers) cannot write invalid values even when
        the underlying database does not enforce length/choices (e.g.
        SQLite).

        Raises ValueError for any disallowed value.
        """
        if field == "default_incident_priority":
            if not isinstance(value, str):
                raise ValueError(
                    f"default_incident_priority must be str, got {type(value).__name__}"
                )
            if len(value) > _PRIORITY_MAXLEN:
                raise ValueError(
                    f"default_incident_priority exceeds max length {_PRIORITY_MAXLEN}"
                )
            if value not in _VALID_PRIORITIES:
                raise ValueError(
                    f"invalid default_incident_priority {value!r}; "
                    f"allowed={sorted(_VALID_PRIORITIES)}"
                )
        elif field == "default_incident_status":
            if not isinstance(value, str):
                raise ValueError(
                    f"default_incident_status must be str, got {type(value).__name__}"
                )
            if len(value) > _STATUS_MAXLEN:
                raise ValueError(
                    f"default_incident_status exceeds max length {_STATUS_MAXLEN}"
                )
            if value not in _VALID_STATUSES:
                raise ValueError(
                    f"invalid default_incident_status {value!r}; "
                    f"allowed={sorted(_VALID_STATUSES)}"
                )
        elif field in (
            "incident_comments_enabled",
            "notification_incident_emails_enabled",
            "notification_escalation_emails_enabled",
            "notification_sla_emails_enabled",
            "sla_auto_apply_default_policy",
            "escalation_auto_apply_default_policy",
        ):
            if not isinstance(value, bool):
                raise ValueError(f"{field} must be bool, got {type(value).__name__}")

    @staticmethod
    @transaction.atomic
    def update_settings(
        settings: OrganizationSettings,
        actor=None,
        request=None,
        **updates,
    ) -> tuple[OrganizationSettings, dict]:
        """
        Apply a partial update to OrganizationSettings.

        Parameters
        ----------
        settings : OrganizationSettings
            The settings record to update.
        actor : User | None
            The authenticated user performing the change (for audit logging).
        request : HttpRequest | None
            The current request (for IP extraction in audit logging).
        **updates
            Field name -> new value for the fields to change. Unknown fields
            are silently ignored by this method; validation is the
            responsibility of the API layer (serializer).

        Returns
        -------
        tuple[OrganizationSettings, dict]
            The updated settings record and a safe before/after changes dict
            suitable for passing to AuditLogService.log().
        """
        before = {}
        after = {}
        changed_fields = []

        for field in _SETTINGS_FIELDS:
            if field in updates:
                new_value = updates[field]
                # Defence-in-depth: validate before mutating.
                OrganizationSettingsService._validate_update_value(field, new_value)
                old_value = getattr(settings, field)
                if old_value != new_value:
                    before[field] = old_value
                    after[field] = new_value
                    setattr(settings, field, new_value)
                    changed_fields.append(field)

        if not changed_fields:
            return settings, {}

        settings.save(update_fields=changed_fields + ["updated_at"])

        changes = {"before": before, "after": after}

        # ── Audit log ────────────────────────────────────────────────────
        from audit_logs.models import AuditAction
        from audit_logs.services import AuditLogService

        AuditLogService.log(
            organization=settings.organization,
            actor=actor,
            action=AuditAction.SETTINGS_UPDATED,
            resource_type="organization_settings",
            resource_id=str(settings.id),
            changes=changes,
            request=request,
        )

        return settings, changes
