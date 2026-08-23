"""
Report Serializers — Phase 13.5

Read-only serializers for operational reporting API responses.
"""

from rest_framework import serializers

# ---------------------------------------------------------------------------
# Incident Summary Serializer
# ---------------------------------------------------------------------------


class IncidentSummarySerializer(serializers.Serializer):
    """Serializer for incident summary metrics."""

    total_incidents = serializers.IntegerField(
        help_text="Total incidents in date range"
    )
    open_incidents = serializers.IntegerField(
        help_text="Currently open incidents (OPEN, ACKNOWLEDGED, IN_PROGRESS)"
    )
    resolved_incidents = serializers.IntegerField(help_text="RESOLVED status incidents")
    closed_incidents = serializers.IntegerField(help_text="CLOSED status incidents")
    unassigned_incidents = serializers.IntegerField(
        help_text="Open incidents without assignee"
    )
    critical_incidents = serializers.IntegerField(help_text="P1 priority incidents")


# ---------------------------------------------------------------------------
# Incidents by Status Serializer
# ---------------------------------------------------------------------------


class IncidentsByStatusSerializer(serializers.Serializer):
    """Serializer for incident counts grouped by status."""

    OPEN = serializers.IntegerField(help_text="OPEN status count")
    ACKNOWLEDGED = serializers.IntegerField(help_text="ACKNOWLEDGED status count")
    IN_PROGRESS = serializers.IntegerField(help_text="IN_PROGRESS status count")
    RESOLVED = serializers.IntegerField(help_text="RESOLVED status count")
    CLOSED = serializers.IntegerField(help_text="CLOSED status count")


# ---------------------------------------------------------------------------
# Incidents by Priority Serializer
# ---------------------------------------------------------------------------


class IncidentsByPrioritySerializer(serializers.Serializer):
    """Serializer for incident counts grouped by priority."""

    P1 = serializers.IntegerField(help_text="P1 (Critical) priority count")
    P2 = serializers.IntegerField(help_text="P2 (High) priority count")
    P3 = serializers.IntegerField(help_text="P3 (Medium) priority count")
    P4 = serializers.IntegerField(help_text="P4 (Low) priority count")


# ---------------------------------------------------------------------------
# Incidents by Category Serializer
# ---------------------------------------------------------------------------


class IncidentsByCategorySerializer(serializers.Serializer):
    """Serializer for incident counts grouped by category."""

    categories = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of category counts with category_id, category_name, and count",
    )


# ---------------------------------------------------------------------------
# Incident Trend Serializer
# ---------------------------------------------------------------------------


class IncidentTrendSerializer(serializers.Serializer):
    """Serializer for incident trend over time."""

    granularity = serializers.CharField(
        help_text="Time granularity used (daily or weekly)"
    )
    data = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of time-ordered data points with date/week and count",
    )


# ---------------------------------------------------------------------------
# SLA Performance Serializer
# ---------------------------------------------------------------------------


class SLAPerformanceSerializer(serializers.Serializer):
    """Serializer for SLA performance metrics."""

    total_sla_incidents = serializers.IntegerField(
        help_text="Total incidents with SLA tracking"
    )
    compliant_incidents = serializers.IntegerField(
        help_text="SLA completed without breach"
    )
    breached_incidents = serializers.IntegerField(
        help_text="SLA breached (response or resolution)"
    )
    completed_sla_records = serializers.IntegerField(
        help_text="SLA records with completion timestamps"
    )
    compliance_percentage = serializers.FloatField(
        help_text="Percentage of compliant incidents (0-100)"
    )


# ---------------------------------------------------------------------------
# Average Resolution Time Serializer
# ---------------------------------------------------------------------------


class AverageResolutionTimeSerializer(serializers.Serializer):
    """Serializer for average resolution time metrics."""

    average_resolution_seconds = serializers.IntegerField(
        help_text="Average time to resolve incidents in seconds"
    )
    resolved_incident_count = serializers.IntegerField(
        help_text="Number of resolved incidents in calculation"
    )


# ---------------------------------------------------------------------------
# Escalation Activity Serializer
# ---------------------------------------------------------------------------


class EscalationActivitySerializer(serializers.Serializer):
    """Serializer for escalation activity metrics."""

    total_escalation_events = serializers.IntegerField(
        help_text="Total escalation events in date range"
    )
    by_level = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Events grouped by escalation level (level -> count)",
    )
    by_trigger_type = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Events grouped by trigger type (trigger -> count)",
    )
