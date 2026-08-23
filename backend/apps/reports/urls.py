"""
Report URL Routes — Phase 13.5

URL patterns for operational reporting API endpoints.
"""

from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    # Incident Summary
    path(
        "summary/",
        views.IncidentSummaryView.as_view(),
        name="incident-summary",
    ),
    # Incidents by Status
    path(
        "incidents/by-status/",
        views.IncidentsByStatusView.as_view(),
        name="incidents-by-status",
    ),
    # Incidents by Priority
    path(
        "incidents/by-priority/",
        views.IncidentsByPriorityView.as_view(),
        name="incidents-by-priority",
    ),
    # Incidents by Category
    path(
        "incidents/by-category/",
        views.IncidentsByCategoryView.as_view(),
        name="incidents-by-category",
    ),
    # Incident Trend
    path(
        "incidents/trend/",
        views.IncidentTrendView.as_view(),
        name="incident-trend",
    ),
    # SLA Performance
    path(
        "sla/",
        views.SLAPerformanceView.as_view(),
        name="sla-performance",
    ),
    # Average Resolution Time
    path(
        "resolution-time/",
        views.AverageResolutionTimeView.as_view(),
        name="average-resolution-time",
    ),
    # Escalation Activity
    path(
        "escalations/",
        views.EscalationActivityView.as_view(),
        name="escalation-activity",
    ),
]
