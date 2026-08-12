"""
SLA selectors — read-only, organization-aware query functions.

All selectors enforce tenant isolation by requiring an organization parameter.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import QuerySet
from incidents.models import Incident
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
