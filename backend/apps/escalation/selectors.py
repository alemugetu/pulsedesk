"""
Escalation selectors — read-only, organization-aware query functions.

All selectors enforce tenant isolation by requiring an organization parameter.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import QuerySet
from escalation.models import (
    EscalationEvent,
    EscalationLevel,
    EscalationPolicy,
    EscalationRule,
    EscalationStatus,
    IncidentEscalation,
)
from incidents.models import Incident
from organizations.models import Organization

# ---------------------------------------------------------------------------
# Escalation Policy selectors
# ---------------------------------------------------------------------------


def get_escalation_policies(
    organization: Organization,
    is_active: bool | None = None,
) -> "QuerySet[EscalationPolicy]":
    """
    Return all escalation policies scoped to an organization.
    Optionally filter by active status.
    """
    qs = EscalationPolicy.objects.filter(organization=organization).prefetch_related(
        "levels", "rules"
    )
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return qs.order_by("name")


def get_escalation_policy(
    organization: Organization,
    policy_id,
) -> EscalationPolicy | None:
    """
    Retrieve a single escalation policy scoped to an organization.
    Returns None if not found or wrong organization (tenant isolation).
    """
    try:
        return EscalationPolicy.objects.prefetch_related("levels", "rules").get(
            id=policy_id,
            organization=organization,
        )
    except (
        EscalationPolicy.DoesNotExist,
        DjangoValidationError,
        TypeError,
        ValueError,
    ):
        return None


def get_default_escalation_policy(
    organization: Organization,
) -> EscalationPolicy | None:
    """
    Return the single active default escalation policy for an organization, or None.

    The partial unique index guarantees at most one record satisfies this query.
    """
    try:
        return EscalationPolicy.objects.prefetch_related("levels", "rules").get(
            organization=organization,
            is_active=True,
            is_default=True,
        )
    except EscalationPolicy.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# Escalation Level selectors
# ---------------------------------------------------------------------------


def get_escalation_levels(
    policy: EscalationPolicy,
) -> "QuerySet[EscalationLevel]":
    """Return all levels for a policy, ordered by level number."""
    return EscalationLevel.objects.filter(policy=policy).order_by("level")


def get_escalation_level(
    policy: EscalationPolicy,
    level_id,
) -> EscalationLevel | None:
    """Retrieve a single escalation level within the given policy, or None."""
    try:
        return EscalationLevel.objects.get(id=level_id, policy=policy)
    except (EscalationLevel.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Escalation Rule selectors
# ---------------------------------------------------------------------------


def get_escalation_rules(policy: EscalationPolicy) -> "QuerySet[EscalationRule]":
    """Return all rules for a policy."""
    return EscalationRule.objects.filter(policy=policy).order_by("trigger_type")


# ---------------------------------------------------------------------------
# IncidentEscalation selectors
# ---------------------------------------------------------------------------


def get_incident_escalations(
    incident: Incident,
    status: str | None = None,
    trigger_type: str | None = None,
) -> "QuerySet[IncidentEscalation]":
    """
    Return all escalation tracking records for an incident.

    Organization isolation is implicit — the incident itself is org-scoped,
    and the policy FK is always from the same org.
    """
    qs = IncidentEscalation.objects.filter(incident=incident).select_related(
        "policy", "incident"
    )
    if status:
        qs = qs.filter(status=status)
    if trigger_type:
        qs = qs.filter(trigger_type=trigger_type)
    return qs.order_by("started_at")


def get_incident_escalation(
    incident: Incident,
    policy: EscalationPolicy,
    trigger_type: str,
) -> IncidentEscalation | None:
    """
    Retrieve a specific IncidentEscalation by (incident, policy, trigger_type).
    Returns None if not found.
    """
    try:
        return IncidentEscalation.objects.select_related("policy", "incident").get(
            incident=incident,
            policy=policy,
            trigger_type=trigger_type,
        )
    except (
        IncidentEscalation.DoesNotExist,
        DjangoValidationError,
        TypeError,
        ValueError,
    ):
        return None


def get_active_incident_escalation(
    incident: Incident,
    trigger_type: str,
) -> IncidentEscalation | None:
    """
    Retrieve the active IncidentEscalation for an incident and trigger type.
    Returns None if no active escalation exists.
    """
    try:
        return IncidentEscalation.objects.select_related("policy").get(
            incident=incident,
            trigger_type=trigger_type,
            status=EscalationStatus.ACTIVE,
        )
    except (
        IncidentEscalation.DoesNotExist,
        IncidentEscalation.MultipleObjectsReturned,
    ):
        return None


# ---------------------------------------------------------------------------
# EscalationEvent selectors
# ---------------------------------------------------------------------------


def get_escalation_events(
    incident_escalation: IncidentEscalation,
) -> "QuerySet[EscalationEvent]":
    """Return all events for an IncidentEscalation, ordered chronologically."""
    return EscalationEvent.objects.filter(
        incident_escalation=incident_escalation
    ).order_by("triggered_at", "level")
