from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils.dateparse import parse_datetime
from incidents.models import Incident, IncidentCategory
from organizations.models import Membership, Organization

# ---------------------------------------------------------------------------
# Filter / search / ordering constants
# ---------------------------------------------------------------------------

#: Valid choices for the sla_state filter (derived from IncidentSLA fields).
VALID_SLA_STATES = ("BREACHED", "ON_TRACK", "COMPLETED")

#: Allowlisted ordering fields — never trust raw client input for order_by().
ALLOWED_ORDERING_FIELDS: dict[str, str] = {
    "created_at": "created_at",
    "-created_at": "-created_at",
    "updated_at": "updated_at",
    "-updated_at": "-updated_at",
    "priority": "priority",
    "-priority": "-priority",
    "status": "status",
    "-status": "-status",
    "sla_deadline": "sla__response_deadline",
    "-sla_deadline": "-sla__response_deadline",
    "incident_number": "incident_number",
    "-incident_number": "-incident_number",
}


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
    Avoids N+1 queries — includes SLA tracking record.
    """
    qs = (
        Incident.objects.filter(organization=organization)
        .select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
            "sla",
            "sla__policy",
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
    Includes SLA tracking record.
    """
    try:
        return Incident.objects.select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
            "sla",
            "sla__policy",
        ).get(id=incident_id, organization=organization)
    except (Incident.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_incident_by_number(
    organization: Organization, incident_number: str
) -> Incident | None:
    """
    Retrieve a single incident by human-readable incident number scoped to an organization.
    Includes SLA tracking record.
    """
    try:
        return Incident.objects.select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
            "sla",
            "sla__policy",
        ).get(incident_number=incident_number, organization=organization)
    except (Incident.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_assigned_incidents(organization: Organization, membership: Membership):
    """
    Return incidents assigned to a specific membership within an organization.
    """
    return get_incidents(organization=organization, assignee_id=str(membership.id))


# ---------------------------------------------------------------------------
# Phase 13.4 — Search, filtering, sorting
# ---------------------------------------------------------------------------


def _resolve_assignee_filter(
    organization: Organization, assignee_id: str
) -> str | None:
    """Validate that *assignee_id* is an active membership in this org.

    Returns the string UUID when valid, or ``None`` when the caller should
    silently return an empty result set (cross-tenant / invalid UUID).
    """
    try:
        exists = Membership.objects.filter(
            id=assignee_id,
            organization=organization,
            status="ACTIVE",
        ).exists()
    except (DjangoValidationError, TypeError, ValueError):
        return None
    return assignee_id if exists else None


def _resolve_category_filter(
    organization: Organization, category_id: str
) -> str | None:
    """Validate that *category_id* is an active category in this org."""
    try:
        exists = IncidentCategory.objects.filter(
            id=category_id,
            organization=organization,
            is_active=True,
        ).exists()
    except (DjangoValidationError, TypeError, ValueError):
        return None
    return category_id if exists else None


def _parse_ordering(ordering_param: str) -> list[str]:
    """Parse a comma-separated ordering string into validated ORM fields.

    Only fields present in ``ALLOWED_ORDERING_FIELDS`` are accepted.
    Unknown tokens are silently ignored so that invalid values never
    reach ``order_by()``.
    """
    order_clauses: list[str] = []
    for part in ordering_param.split(","):
        part = part.strip()
        if part in ALLOWED_ORDERING_FIELDS:
            order_clauses.append(ALLOWED_ORDERING_FIELDS[part])
    return order_clauses


def _parse_dt_param(value: str):
    """Parse an ISO-8601 datetime from a URL query parameter.

    URL query-string decoding turns ``+`` into a space, so a value like
    ``2026-01-01T00:00:00+00:00`` arrives as
    ``2026-01-01T00:00:00 00:00``.  We try the raw string first, then
    attempt to restore the ``+`` before the timezone offset.
    """
    dt = parse_datetime(value)
    if dt is not None:
        return dt
    # Try restoring '+' from space (URL-encoded timezone offset).
    dt = parse_datetime(value.replace(" ", "+", 1))
    return dt


def filter_incidents(
    organization: Organization,
    *,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: str | None = None,
    category_id: str | None = None,
    created_after: str | None = None,
    created_before: str | None = None,
    sla_state: str | None = None,
    team_id: str | None = None,
    ordering: str | None = None,
):
    """Return a filtered, searched, and sorted queryset of incidents.

    This is the single query entry-point for the incident list API.
    All filtering, text search, and ordering happens in PostgreSQL
    (or SQLite during tests) — never in Python.

    Tenant isolation is enforced: every row belongs to *organization*.
    Foreign-key filters (assignee, category) are validated against the
    organization scope so that cross-tenant UUIDs return empty results
    without leaking existence information.
    """
    # -- Base query with eager joins (prevents N+1) --------------------
    qs = (
        Incident.objects.filter(organization=organization)
        .select_related(
            "category",
            "reporter",
            "assignee",
            "assignee__user",
            "assignee__role",
            "sla",
            "sla__policy",
        )
    )

    # -- Text search (title, description, incident_number) -------------
    if search:
        qs = qs.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(incident_number__icontains=search)
        )

    # -- Status filter -------------------------------------------------
    if status:
        qs = qs.filter(status=status)

    # -- Priority filter -----------------------------------------------
    if priority:
        qs = qs.filter(priority=priority)

    # -- Assignee filter (with tenant validation) ----------------------
    if assignee_id:
        resolved = _resolve_assignee_filter(organization, assignee_id)
        if resolved is None:
            return qs.none()
        qs = qs.filter(assignee_id=resolved)

    # -- Category filter (with tenant validation) ----------------------
    if category_id:
        resolved = _resolve_category_filter(organization, category_id)
        if resolved is None:
            return qs.none()
        qs = qs.filter(category_id=resolved)

    # -- Date-range filter ---------------------------------------------
    if created_after:
        dt = _parse_dt_param(created_after)
        if dt is not None:
            qs = qs.filter(created_at__gte=dt)
    if created_before:
        dt = _parse_dt_param(created_before)
        if dt is not None:
            qs = qs.filter(created_at__lte=dt)

    # -- SLA state filter (delegates to IncidentSLA data) --------------
    if sla_state:
        if sla_state == "BREACHED":
            qs = qs.filter(
                Q(sla__response_breached=True)
                | Q(sla__resolution_breached=True)
            )
        elif sla_state == "ON_TRACK":
            qs = qs.filter(
                sla__isnull=False,
                sla__response_breached=False,
                sla__resolution_breached=False,
            ).filter(
                Q(sla__response_completed_at__isnull=True)
                | Q(sla__resolution_completed_at__isnull=True)
            )
        elif sla_state == "COMPLETED":
            qs = qs.filter(
                sla__response_completed_at__isnull=False,
                sla__resolution_completed_at__isnull=False,
            )
        else:
            # Unknown SLA state — return nothing rather than ignoring.
            return qs.none()

    # -- Team filter (no Team model exists yet) -----------------------
    if team_id:
        # No Team model in the current schema.  Return empty rather than
        # silently ignoring the parameter.
        return qs.none()

    # -- Ordering (allowlisted, safe) ---------------------------------
    order_clauses: list[str] = []
    if ordering:
        order_clauses = _parse_ordering(ordering)
    # Deterministic secondary ordering tiebreaker
    if "-created_at" not in order_clauses and "created_at" not in order_clauses:
        order_clauses.append("-created_at")
    qs = qs.order_by(*order_clauses)

    return qs
