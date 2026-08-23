"""
Selectors for AuditLog queries.

All selectors are organization-scoped to enforce tenant isolation.
Never query AuditLog without an organization constraint.

Supported filters (all optional):
    action          — exact AuditAction value
    resource_type   — e.g. "incident", "comment"
    resource_id     — string PK of a specific resource
    actor_id        — UUID of the user who performed the action
    date_from       — inclusive lower bound on created_at
    date_to         — inclusive upper bound on created_at

Results are ordered newest-first and intended to be paginated by the view.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from organizations.models import Organization


def get_audit_logs(
    organization: Organization,
    action: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    actor_id=None,
    date_from=None,
    date_to=None,
):
    """
    Return a filtered, organization-scoped QuerySet of AuditLog records.

    Always scoped to the provided organization — never returns records from
    other organizations.

    Args:
        organization:   The tenant whose audit logs to return.
        action:         Filter to a single AuditAction value.
        resource_type:  Filter to a specific resource type.
        resource_id:    Filter to a specific resource instance.
        actor_id:       Filter to actions performed by a specific user (UUID).
        date_from:      Only include records created at or after this datetime.
        date_to:        Only include records created at or before this datetime.

    Returns:
        QuerySet[AuditLog] ordered by -created_at with actor selected.
    """
    from audit_logs.models import AuditLog

    qs = (
        AuditLog.objects.filter(organization=organization)
        .select_related("actor")
        .order_by("-created_at")
    )

    if action:
        qs = qs.filter(action=action)

    if resource_type:
        qs = qs.filter(resource_type=resource_type)

    if resource_id:
        qs = qs.filter(resource_id=str(resource_id))

    if actor_id:
        try:
            qs = qs.filter(actor_id=actor_id)
        except (DjangoValidationError, ValueError, TypeError):
            # Invalid UUID — return empty queryset rather than error.
            qs = qs.none()

    if date_from:
        qs = qs.filter(created_at__gte=date_from)

    if date_to:
        qs = qs.filter(created_at__lte=date_to)

    return qs


def get_audit_log(organization: Organization, audit_log_id):
    """
    Retrieve a single AuditLog record scoped to the organization.

    Prevents IDOR: the record must belong to the provided organization.

    Args:
        organization:   The tenant to scope the lookup.
        audit_log_id:   UUID of the audit log record.

    Returns:
        AuditLog instance, or None if not found or not in this organization.
    """
    from audit_logs.models import AuditLog

    try:
        return AuditLog.objects.select_related("actor").get(
            id=audit_log_id,
            organization=organization,
        )
    except (AuditLog.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_resource_audit_logs(
    organization: Organization,
    resource_type: str,
    resource_id: str,
):
    """
    Return all audit log entries for a specific resource within an organization.

    Convenience wrapper used to show the history of a single incident, comment, etc.

    Args:
        organization:   The tenant.
        resource_type:  e.g. "incident".
        resource_id:    String PK of the resource.

    Returns:
        QuerySet[AuditLog] ordered by -created_at.
    """
    return get_audit_logs(
        organization=organization,
        resource_type=resource_type,
        resource_id=str(resource_id),
    )
