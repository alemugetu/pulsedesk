"""
Report Selectors — Phase 13.5

Database-side aggregation for operational reporting.

All selectors are organization-scoped and use PostgreSQL aggregation
to avoid N+1 queries and Python-side processing.
"""

from datetime import datetime, timedelta
from typing import Any

from django.db import models
from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncDate, TruncWeek
from django.utils import timezone
from escalation.models import EscalationEvent
from incidents.models import Incident, IncidentPriority, IncidentStatus
from organizations.models import Organization
from sla.models import IncidentSLA

# ---------------------------------------------------------------------------
# Date Range Handling
# ---------------------------------------------------------------------------

_DEFAULT_REPORT_DAYS = 30


def parse_date_range(
    start: str | None = None,
    end: str | None = None,
) -> tuple[datetime, datetime]:
    """
    Parse and validate date range parameters.

    Returns a half-open interval [start, end) where:
    - start is inclusive (>=)
    - end is exclusive (<)

    Default: last 30 days from now.
    """
    now = timezone.now()

    if end:
        try:
            end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
            if end_dt.tzinfo is None:
                end_dt = timezone.make_aware(end_dt)
        except (ValueError, AttributeError):
            end_dt = now
    else:
        end_dt = now

    if start:
        try:
            start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            if start_dt.tzinfo is None:
                start_dt = timezone.make_aware(start_dt)
        except (ValueError, AttributeError):
            start_dt = end_dt - timedelta(days=_DEFAULT_REPORT_DAYS)
    else:
        start_dt = end_dt - timedelta(days=_DEFAULT_REPORT_DAYS)

    # Ensure start <= end
    start_dt = min(start_dt, end_dt)

    return start_dt, end_dt


# ---------------------------------------------------------------------------
# Incident Summary
# ---------------------------------------------------------------------------


def get_incident_summary(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, int]:
    """
    Returns organization-scoped incident summary metrics.

    Metrics:
    - total_incidents: Total incidents in date range
    - open_incidents: Currently open (OPEN, ACKNOWLEDGED, IN_PROGRESS)
    - resolved_incidents: RESOLVED status
    - closed_incidents: CLOSED status
    - unassigned_incidents: Open incidents without assignee
    - critical_incidents: P1 priority incidents
    """
    start_dt, end_dt = parse_date_range(start, end)

    open_statuses = [
        IncidentStatus.OPEN,
        IncidentStatus.ACKNOWLEDGED,
        IncidentStatus.IN_PROGRESS,
    ]

    # Base queryset scoped to organization and date range
    qs = Incident.objects.filter(
        organization=organization,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
    )

    # Aggregate all metrics in a single query
    summary = qs.aggregate(
        total_incidents=Count("id"),
        open_incidents=Count("id", filter=Q(status__in=open_statuses)),
        resolved_incidents=Count("id", filter=Q(status=IncidentStatus.RESOLVED)),
        closed_incidents=Count("id", filter=Q(status=IncidentStatus.CLOSED)),
        unassigned_incidents=Count(
            "id",
            filter=Q(status__in=open_statuses, assignee__isnull=True),
        ),
        critical_incidents=Count(
            "id",
            filter=Q(priority=IncidentPriority.P1),
        ),
    )

    return summary


# ---------------------------------------------------------------------------
# Incidents by Status
# ---------------------------------------------------------------------------


def get_incidents_by_status(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, int]:
    """
    Returns incident counts grouped by status.

    Uses database aggregation with GROUP BY.
    """
    start_dt, end_dt = parse_date_range(start, end)

    counts = (
        Incident.objects.filter(
            organization=organization,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .values("status")
        .annotate(count=Count("id"))
    )

    # Initialize with all possible statuses
    result = {status.value: 0 for status in IncidentStatus}
    for item in counts:
        result[item["status"]] = item["count"]

    return result


# ---------------------------------------------------------------------------
# Incidents by Priority
# ---------------------------------------------------------------------------


def get_incidents_by_priority(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, int]:
    """
    Returns incident counts grouped by priority.

    Uses database aggregation with GROUP BY.
    """
    start_dt, end_dt = parse_date_range(start, end)

    counts = (
        Incident.objects.filter(
            organization=organization,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .values("priority")
        .annotate(count=Count("id"))
    )

    # Initialize with all possible priorities
    result = {priority.value: 0 for priority in IncidentPriority}
    for item in counts:
        result[item["priority"]] = item["count"]

    return result


# ---------------------------------------------------------------------------
# Incidents by Category
# ---------------------------------------------------------------------------


def get_incidents_by_category(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> list[dict[str, Any]]:
    """
    Returns incident counts grouped by category.

    Handles uncategorized incidents (category IS NULL) safely.
    Only returns categories belonging to the organization.
    """
    start_dt, end_dt = parse_date_range(start, end)

    # Use COALESCE to handle NULL categories
    counts = (
        Incident.objects.filter(
            organization=organization,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .annotate(category_name=F("category__name"))
        .values("category", "category_name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    result = []
    for item in counts:
        result.append(
            {
                "category_id": (
                    str(item["category"]) if item["category"] else None
                ),
                "category_name": item["category_name"] or "Uncategorized",
                "count": item["count"],
            }
        )

    return result


# ---------------------------------------------------------------------------
# Incident Trend
# ---------------------------------------------------------------------------


def get_incident_trend(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
    granularity: str = "daily",
) -> list[dict[str, Any]]:
    """
    Returns incident volume over time grouped by granularity.

    Supported granularity:
    - daily: Group by calendar day
    - weekly: Group by ISO week

    Uses database date truncation for efficiency.
    """
    start_dt, end_dt = parse_date_range(start, end)

    if granularity not in ("daily", "weekly"):
        raise ValueError(f"Invalid granularity: {granularity}")

    # Choose truncation function based on granularity
    if granularity == "daily":
        trunc_func = TruncDate
        date_field = "date"
    else:  # weekly
        trunc_func = TruncWeek
        date_field = "week"

    # Aggregate with date truncation
    qs = (
        Incident.objects.filter(
            organization=organization,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .annotate(period=trunc_func("created_at"))
        .values("period")
        .annotate(count=Count("id"))
        .order_by("period")
    )

    result = []
    for item in qs:
        result.append(
            {
                date_field: item["period"].isoformat(),
                "count": item["count"],
            }
        )

    return result


# ---------------------------------------------------------------------------
# SLA Performance
# ---------------------------------------------------------------------------


def get_sla_performance(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    """
    Returns SLA performance metrics using existing IncidentSLA data.

    Metrics:
    - total_sla_incidents: Incidents with SLA tracking
    - compliant_incidents: SLA completed without breach
    - breached_incidents: SLA breached (response or resolution)
    - completed_sla_records: SLA records with completion timestamps
    - compliance_percentage: Percentage of compliant incidents

    Uses authoritative IncidentSLA fields only.
    Does not reimplement SLA calculation logic.
    """
    start_dt, end_dt = parse_date_range(start, end)

    sla_qs = IncidentSLA.objects.filter(
        incident__organization=organization,
        incident__created_at__gte=start_dt,
        incident__created_at__lt=end_dt,
    )

    # Aggregate SLA metrics
    metrics = sla_qs.aggregate(
        total_sla_incidents=Count("id"),
        breached_incidents=Count(
            "id",
            filter=Q(response_breached=True) | Q(resolution_breached=True),
        ),
        completed_sla_records=Count(
            "id",
            filter=Q(response_completed_at__isnull=False)
            | Q(resolution_completed_at__isnull=False),
        ),
    )

    # Compliant = not breached and has completion timestamp
    compliant_count = (
        sla_qs.filter(
            response_breached=False,
            resolution_breached=False,
        )
        .filter(
            Q(response_completed_at__isnull=False)
            | Q(resolution_completed_at__isnull=False)
        )
        .count()
    )

    metrics["compliant_incidents"] = compliant_count

    # Calculate compliance percentage
    total = metrics["total_sla_incidents"]
    if total > 0:
        metrics["compliance_percentage"] = round((compliant_count / total) * 100, 2)
    else:
        metrics["compliance_percentage"] = 0.0

    return metrics


# ---------------------------------------------------------------------------
# Average Resolution Time
# ---------------------------------------------------------------------------


def get_average_resolution_time(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    """
    Calculates average resolution time for resolved incidents.

    Uses authoritative incident timestamps:
    - resolution_time = resolved_at - created_at
    - Only includes incidents where resolved_at is not NULL

    Returns:
    - average_resolution_seconds: Average time in seconds
    - resolved_incident_count: Number of resolved incidents in calculation
    """
    start_dt, end_dt = parse_date_range(start, end)

    # Filter for resolved incidents (resolved_at is not NULL)
    resolved_qs = Incident.objects.filter(
        organization=organization,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
        resolved_at__isnull=False,
    )

    # Calculate average using database aggregation
    result = resolved_qs.aggregate(
        avg_resolution_seconds=Avg(
            F("resolved_at") - F("created_at"),
            output_field=models.DurationField(),
        ),
        resolved_incident_count=Count("id"),
    )

    # Convert timedelta to seconds
    avg_timedelta = result["avg_resolution_seconds"]
    if avg_timedelta is not None:
        avg_seconds = avg_timedelta.total_seconds()
    else:
        avg_seconds = 0

    return {
        "average_resolution_seconds": round(avg_seconds),
        "resolved_incident_count": result["resolved_incident_count"],
    }


# ---------------------------------------------------------------------------
# Escalation Activity
# ---------------------------------------------------------------------------


def get_escalation_activity(
    organization: Organization,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    """
    Returns escalation activity metrics based on EscalationEvent data.

    Metrics:
    - total_escalation_events: Total escalation events
    - by_level: Events grouped by escalation level
    - by_trigger_type: Events grouped by trigger type

    Uses actual EscalationEvent fields and choices.
    """
    start_dt, end_dt = parse_date_range(start, end)

    event_qs = EscalationEvent.objects.filter(
        incident_escalation__incident__organization=organization,
        triggered_at__gte=start_dt,
        triggered_at__lt=end_dt,
    )

    # Total events
    total_events = event_qs.count()

    # Group by level
    by_level = event_qs.values("level").annotate(count=Count("id")).order_by("level")
    level_counts = {str(item["level"]): item["count"] for item in by_level}

    # Group by trigger type
    by_trigger = (
        event_qs.values("trigger_type")
        .annotate(count=Count("id"))
        .order_by("trigger_type")
    )
    trigger_counts = {item["trigger_type"]: item["count"] for item in by_trigger}

    return {
        "total_escalation_events": total_events,
        "by_level": level_counts,
        "by_trigger_type": trigger_counts,
    }
