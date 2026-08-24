from django.core.exceptions import ValidationError as DjangoValidationError
from organizations.models import Organization
from settings.models import OrganizationSettings


def get_settings_for_organization(organization: Organization) -> OrganizationSettings:
    """
    Return the OrganizationSettings for an organization, creating them with
    default values if they do not exist.

    This is the canonical retrieval path. Callers should always use this
    selector rather than querying OrganizationSettings directly, because
    it handles legacy organizations that pre-date the settings model.
    """
    settings, _created = OrganizationSettings.objects.get_or_create(
        organization=organization,
        defaults={
            "default_incident_priority": "P3",
            "default_incident_status": "OPEN",
            "incident_comments_enabled": True,
            "notification_incident_emails_enabled": True,
            "notification_escalation_emails_enabled": True,
            "notification_sla_emails_enabled": True,
            "sla_auto_apply_default_policy": True,
            "escalation_auto_apply_default_policy": True,
        },
    )
    return settings


def get_settings_by_org_id(organization_id) -> OrganizationSettings | None:
    """
    Look up settings by organization UUID. Returns None if the organization
    does not exist or the UUID is malformed.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except (
        Organization.DoesNotExist,
        DjangoValidationError,
        TypeError,
        ValueError,
    ):
        return None
    return get_settings_for_organization(organization)
