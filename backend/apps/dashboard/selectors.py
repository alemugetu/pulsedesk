from typing import Any

from django.conf import settings
from django.db.models import Count, F, Q, QuerySet
from django.utils import timezone
from escalation.models import (
    EscalationStatus,
    IncidentEscalation,
)
from incidents.models import Incident, IncidentPriority, IncidentStatus
from organizations.models import Organization
from sla.models import IncidentSLA

_DEFAULT_WARNING_THRESHOLD = 0.80


def get_dashboard_summary(organization: Organization) -> dict[str, int]:
    """
    Returns high-level aggregate metrics for the operations dashboard.
    """
    now = timezone.now()
    threshold = float(
        getattr(settings, "SLA_WARNING_THRESHOLD", _DEFAULT_WARNING_THRESHOLD)
    )

    open_statuses = [
        IncidentStatus.OPEN,
        IncidentStatus.ACKNOWLEDGED,
        IncidentStatus.IN_PROGRESS,
    ]

    # 1. Incident counts
    incident_stats = Incident.objects.filter(organization=organization).aggregate(
        open_incidents=Count("id", filter=Q(status__in=open_statuses)),
        unassigned_incidents=Count(
            "id", filter=Q(status__in=open_statuses, assignee__isnull=True)
        ),
    )

    # 2. SLA metrics
    sla_qs = IncidentSLA.objects.filter(incident__organization=organization)

    # SLA Breached
    sla_breached = sla_qs.filter(
        Q(response_breached=True) | Q(resolution_breached=True)
    ).count()

    # SLA At Risk (Approaching deadline)
    # elapsed / total >= threshold  =>  elapsed >= total * threshold
    # elapsed = now - created_at
    # total = deadline - created_at

    # We use annotation for the calculation to keep it efficient at the DB level.
    # Note: Postgres allows Duration * Float multiplication.
    sla_at_risk = (
        sla_qs.annotate(
            resp_total=F("response_deadline") - F("created_at"),
            resp_elapsed=now - F("created_at"),
            resol_total=F("resolution_deadline") - F("created_at"),
            resol_elapsed=now - F("created_at"),
        )
        .filter(
            (
                Q(response_completed_at__isnull=True, response_breached=False)
                & Q(resp_elapsed__gte=F("resp_total") * threshold)
            )
            | (
                Q(resolution_completed_at__isnull=True, resolution_breached=False)
                & Q(resol_elapsed__gte=F("resol_total") * threshold)
            )
        )
        .count()
    )

    # 3. Escalation metrics
    active_escalations = IncidentEscalation.objects.filter(
        incident__organization=organization, status=EscalationStatus.ACTIVE
    ).count()

    return {
        "open_incidents": incident_stats["open_incidents"],
        "unassigned_incidents": incident_stats["unassigned_incidents"],
        "sla_at_risk": sla_at_risk,
        "sla_breached": sla_breached,
        "active_escalations": active_escalations,
    }


def get_priority_distribution(organization: Organization) -> dict[str, int]:
    """
    Returns incident counts grouped by priority.
    """
    counts = (
        Incident.objects.filter(organization=organization)
        .values("priority")
        .annotate(count=Count("id"))
    )

    # Initialize with zeros for all priorities
    result = {p: 0 for p in IncidentPriority.values}
    for item in counts:
        result[item["priority"]] = item["count"]

    return result


def get_sla_metrics(organization: Organization) -> dict[str, int]:
    """
    Returns detailed SLA metrics.
    """
    sla_qs = IncidentSLA.objects.filter(incident__organization=organization)
    now = timezone.now()
    threshold = float(
        getattr(settings, "SLA_WARNING_THRESHOLD", _DEFAULT_WARNING_THRESHOLD)
    )

    # Annotate with at_risk flags for aggregation
    annotated_qs = sla_qs.annotate(
        resp_total=F("response_deadline") - F("created_at"),
        resp_elapsed=now - F("created_at"),
        resol_total=F("resolution_deadline") - F("created_at"),
        resol_elapsed=now - F("created_at"),
    ).annotate(
        is_resp_at_risk=Q(
            response_completed_at__isnull=True,
            response_breached=False,
            resp_elapsed__gte=F("resp_total") * threshold,
        ),
        is_resol_at_risk=Q(
            resolution_completed_at__isnull=True,
            resolution_breached=False,
            resol_elapsed__gte=F("resol_total") * threshold,
        ),
    )

    metrics = annotated_qs.aggregate(
        healthy=Count(
            "id",
            filter=Q(
                response_breached=False,
                resolution_breached=False,
                is_resp_at_risk=False,
                is_resol_at_risk=False,
            )
            & (
                Q(response_completed_at__isnull=True)
                | Q(resolution_completed_at__isnull=True)
            ),
        ),
        approaching=Count(
            "id", filter=Q(is_resp_at_risk=True) | Q(is_resol_at_risk=True)
        ),
        breached=Count(
            "id", filter=Q(response_breached=True) | Q(resolution_breached=True)
        ),
        resolved_within_sla=Count(
            "id",
            filter=Q(resolution_completed_at__isnull=False, resolution_breached=False),
        ),
        response_breaches=Count("id", filter=Q(response_breached=True)),
        resolution_breaches=Count("id", filter=Q(resolution_breached=True)),
    )

    return metrics


def get_escalation_metrics(organization: Organization) -> dict[str, Any]:
    """
    Returns detailed escalation metrics.
    """
    qs = IncidentEscalation.objects.filter(incident__organization=organization)

    summary = qs.aggregate(
        active=Count("id", filter=Q(status=EscalationStatus.ACTIVE)),
        completed=Count("id", filter=Q(status=EscalationStatus.COMPLETED)),
        cancelled=Count("id", filter=Q(status=EscalationStatus.CANCELLED)),
    )

    # By level distribution (for active escalations)
    level_counts = (
        qs.filter(status=EscalationStatus.ACTIVE)
        .values("current_level")
        .annotate(count=Count("id"))
        .order_by("current_level")
    )

    summary["by_level"] = {
        str(item["current_level"]): item["count"] for item in level_counts
    }

    return summary


def get_dashboard_incidents(
    organization: Organization,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: str | None = None,
    sla_state: str | None = None,
    escalation_state: str | None = None,
) -> QuerySet:
    """
    Returns a filtered and optimized queryset of incidents for the dashboard.
    """
    # Use select_related/prefetch_related to avoid N+1
    qs = (
        Incident.objects.filter(organization=organization)
        .select_related(
            "assignee__user",
            "category",
            "reporter",
            "sla",
        )
        .prefetch_related("escalations")
    )

    if status:
        qs = qs.filter(status=status)
    if priority:
        qs = qs.filter(priority=priority)
    if assignee_id:
        qs = qs.filter(assignee_id=assignee_id)

    if sla_state:
        # sla_state can be 'HEALTHY', 'AT_RISK', 'BREACHED'
        now = timezone.now()
        threshold = float(
            getattr(settings, "SLA_WARNING_THRESHOLD", _DEFAULT_WARNING_THRESHOLD)
        )

        if sla_state == "BREACHED":
            qs = qs.filter(
                Q(sla__response_breached=True) | Q(sla__resolution_breached=True)
            )
        elif sla_state == "AT_RISK":
            qs = qs.annotate(
                resp_total=F("sla__response_deadline") - F("sla__created_at"),
                resp_elapsed=now - F("sla__created_at"),
                resol_total=F("sla__resolution_deadline") - F("sla__created_at"),
                resol_elapsed=now - F("sla__created_at"),
            ).filter(
                (
                    Q(
                        sla__response_completed_at__isnull=True,
                        sla__response_breached=False,
                    )
                    & Q(resp_elapsed__gte=F("resp_total") * threshold)
                )
                | (
                    Q(
                        sla__resolution_completed_at__isnull=True,
                        sla__resolution_breached=False,
                    )
                    & Q(resol_elapsed__gte=F("resol_total") * threshold)
                )
            )
        elif sla_state == "HEALTHY":
            # Not breached and not at risk
            # This is complex to do inverse, so maybe we just filter out the others
            # but simpler is to use similar annotation logic.
            qs = (
                qs.annotate(
                    resp_total=F("sla__response_deadline") - F("sla__created_at"),
                    resp_elapsed=now - F("sla__created_at"),
                    resol_total=F("sla__resolution_deadline") - F("sla__created_at"),
                    resol_elapsed=now - F("sla__created_at"),
                )
                .filter(sla__response_breached=False, sla__resolution_breached=False)
                .exclude(
                    (
                        Q(sla__response_completed_at__isnull=True)
                        & Q(resp_elapsed__gte=F("resp_total") * threshold)
                    )
                    | (
                        Q(sla__resolution_completed_at__isnull=True)
                        & Q(resol_elapsed__gte=F("resol_total") * threshold)
                    )
                )
            )

    if escalation_state:
        # escalation_state can be 'ACTIVE', 'COMPLETED', 'CANCELLED'
        qs = qs.filter(escalations__status=escalation_state).distinct()

    return qs
