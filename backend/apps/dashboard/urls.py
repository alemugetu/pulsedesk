from django.urls import path

from .views import (
    DashboardIncidentListView,
    DashboardSummaryView,
    EscalationMetricsView,
    PriorityDistributionView,
    SLAMetricsView,
)

app_name = "dashboard"

urlpatterns = [
    path(
        "summary/",
        DashboardSummaryView.as_view(),
        name="summary",
    ),
    path(
        "priority-distribution/",
        PriorityDistributionView.as_view(),
        name="priority-distribution",
    ),
    path(
        "sla-metrics/",
        SLAMetricsView.as_view(),
        name="sla-metrics",
    ),
    path(
        "escalation-metrics/",
        EscalationMetricsView.as_view(),
        name="escalation-metrics",
    ),
    path(
        "incidents/",
        DashboardIncidentListView.as_view(),
        name="incidents",
    ),
]
