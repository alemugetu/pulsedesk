"""
Selectors for Attachment queries.

All selectors are organization/incident-scoped to prevent IDOR vulnerabilities.
Never call Attachment.objects.get(pk=...) without first scoping to an incident
that has been validated against the requesting user's organization.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from incidents.models import Incident


def get_attachments(incident: Incident):
    """
    Return all attachments for a validated incident.

    Tenant isolation is enforced through the incident's organization
    relationship.  The caller is responsible for ensuring `incident`
    already belongs to the requesting user's organization before
    calling this selector.

    Args:
        incident: Organization-scoped incident instance.

    Returns:
        QuerySet of Attachment objects ordered by creation time (oldest first).
    """
    from attachments.models import Attachment

    return (
        Attachment.objects.filter(incident=incident)
        .select_related("uploader", "incident")
        .order_by("created_at")
    )


def get_attachment(incident: Incident, attachment_id):
    """
    Retrieve a single Attachment by UUID scoped to an incident.

    Prevents IDOR by requiring the attachment to belong to the provided
    incident (which is already validated against the user's organization).

    Args:
        incident: Organization-scoped incident instance.
        attachment_id: UUID of the attachment to retrieve.

    Returns:
        Attachment instance, or None if not found or not belonging to the incident.
    """
    from attachments.models import Attachment

    try:
        return Attachment.objects.select_related(
            "uploader", "incident", "incident__organization"
        ).get(
            id=attachment_id,
            incident=incident,
        )
    except (Attachment.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None
