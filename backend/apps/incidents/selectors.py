from django.core.exceptions import ValidationError as DjangoValidationError
from incidents.models import Incident, IncidentCategory
from organizations.models import Membership, Organization


def get_categories(organization: Organization, is_active: bool | None = None):
    """
    Return all incident categories scoped to an organization.
    """
    qs = IncidentCategory.objects.filter(organization=organization)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return qs.order_by("name")


def get_category(organization: Organization, category_id) -> IncidentCategory | None:
    """
    Retrieve a single incident category scoped to an organization.
    """
    try:
        return IncidentCategory.objects.get(
            id=category_id,
            organization=organization,
        )
    except (
        IncidentCategory.DoesNotExist,
        DjangoValidationError,
        TypeError,
        ValueError,
    ):
        return None


def get_incidents(
    organization: Organization,
    status: str | None = None,
    priority: str | None = None,
    category_id: str | None = None,
    assignee_id: str | None = None,
):
    """
    Return queryset of incidents for an organization with optimized joins.
    Avoids N+1 queries.
    """
    qs = (
        Incident.objects.filter(organization=organization)
        .select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
        )
        .order_by("-created_at")
    )

    if status:
        qs = qs.filter(status=status)
    if priority:
        qs = qs.filter(priority=priority)
    if category_id:
        qs = qs.filter(category_id=category_id)
    if assignee_id:
        qs = qs.filter(assignee_id=assignee_id)

    return qs


def get_incident(organization: Organization, incident_id) -> Incident | None:
    """
    Retrieve a single incident by UUID scoped to an organization.
    """
    try:
        return Incident.objects.select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
        ).get(id=incident_id, organization=organization)
    except (Incident.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_incident_by_number(
    organization: Organization, incident_number: str
) -> Incident | None:
    """
    Retrieve a single incident by human-readable incident number scoped to an organization.
    """
    try:
        return Incident.objects.select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
        ).get(incident_number=incident_number, organization=organization)
    except (Incident.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_assigned_incidents(organization: Organization, membership: Membership):
    """
    Return incidents assigned to a specific membership within an organization.
    """
    return get_incidents(organization=organization, assignee_id=str(membership.id))
