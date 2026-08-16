"""
SLA selectors — read-only, organization-aware query functions.

All selectors enforce tenant isolation by requiring an organization parameter.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import QuerySet
from django.utils import timezone
from incidents.models import Incident, IncidentStatus
from organizations.models import Organization
from sla.models import IncidentSLA, SLAPolicy, SLATarget


def get_sla_policies(
    organization: Organization,
    is_active: bool | None = None,
) -> "QuerySet[SLAPolicy]":
    """
    Return all SLA policies scoped to an organization.
    Optionally filter by active status.
    """
    qs = SLAPolicy.objects.filter(organization=organization).prefetch_related("targets")
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return qs.order_by("name")


def get_sla_policy(
    organization: Organization,
    policy_id,
) -> SLAPolicy | None:
    """
    Retrieve a single SLA policy scoped to an organization.
    Returns None if not found or wrong organization (tenant isolation).
    """
    try:
        return SLAPolicy.objects.prefetch_related("targets").get(
            id=policy_id,
            organization=organization,
        )
    except (SLAPolicy.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_default_sla_policy(organization: Organization) -> SLAPolicy | None:
    """
    Return the single active default SLA policy for an organization, or None.

    The partial unique index (organization, is_default=True, is_active=True)
    guarantees at most one record satisfies this query.
    """
    try:
        return SLAPolicy.objects.prefetch_related("targets").get(
            organization=organization,
            is_active=True,
            is_default=True,
        )
    except SLAPolicy.DoesNotExist:
        return None


def get_sla_target(
    policy: SLAPolicy,
    priority: str,
) -> SLATarget | None:
    """
    Retrieve the SLA target for a specific policy and incident priority.
    Returns None if not found.
    """
    try:
        return SLATarget.objects.get(policy=policy, priority=priority)
    except SLATarget.DoesNotExist:
        return None


def get_incident_sla(incident: Incident) -> IncidentSLA | None:
    """
    Retrieve the SLA tracking record for a single incident.
    Returns None if no SLA was assigned to the incident.
    """
    try:
        return IncidentSLA.objects.select_related("policy").get(incident=incident)
    except IncidentSLA.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# SLA monitoring selector
# ---------------------------------------------------------------------------

#: Incident statuses that are considered active (eligible for SLA monitoring).
#: RESOLVED and CLOSED are terminal — their SLAs are no longer monitored.
_ACTIVE_INCIDENT_STATUSES = (
    IncidentStatus.OPEN,
    IncidentStatus.ACKNOWLEDGED,
    IncidentStatus.IN_PROGRESS,
)


def get_active_incidents_for_sla_monitoring() -> "QuerySet[Incident]":
    """
    Return all active incidents that have an associated SLA record.

    Used exclusively by the SLA monitoring background task. This selector:
      - Filters to active statuses only (OPEN, ACKNOWLEDGED, IN_PROGRESS).
      - Requires that an IncidentSLA record exists (inner join via __isnull=False).
      - Eagerly joins the related SLA and its policy, and the incident's
        organization, to prevent N+1 queries in the monitoring loop.
      - Does NOT filter by org — this is a system-level cross-org query.
        Tenant isolation is enforced at the service level when we call the
        existing org-scoped SLA/escalation services.

    Returns an unevaluated queryset — callers should use .iterator() for
    large datasets to avoid loading all incidents into memory at once.
    """
    return (
        Incident.objects.filter(
            status__in=_ACTIVE_INCIDENT_STATUSES,
            sla__isnull=False,
        )
        .select_related(
            "organization",
            "sla",
            "sla__policy",
        )
        .order_by("created_at")  # Stable, reproducible iteration order
    )
