from django.urls import path
from escalation import views

app_name = "escalation"

urlpatterns = [
    # Escalation Policy list / create
    path(
        "escalation-policies/",
        views.EscalationPolicyListCreateView.as_view(),
        name="policy-list",
    ),
    # Escalation Policy detail / update
    path(
        "escalation-policies/<uuid:policy_id>/",
        views.EscalationPolicyDetailView.as_view(),
        name="policy-detail",
    ),
    # Escalation Level list / create
    path(
        "escalation-policies/<uuid:policy_id>/levels/",
        views.EscalationLevelListCreateView.as_view(),
        name="level-list",
    ),
    # Escalation Level detail / update
    path(
        "escalation-policies/<uuid:policy_id>/levels/<uuid:level_id>/",
        views.EscalationLevelDetailView.as_view(),
        name="level-detail",
    ),
    # Escalation Rule list / create
    path(
        "escalation-policies/<uuid:policy_id>/rules/",
        views.EscalationRuleListCreateView.as_view(),
        name="rule-list",
    ),
    # Incident escalation history (read-only)
    path(
        "incidents/<uuid:incident_id>/escalations/",
        views.IncidentEscalationHistoryView.as_view(),
        name="incident-escalation-history",
    ),
    # Manual escalation evaluation
    path(
        "incidents/<uuid:incident_id>/escalations/evaluate/",
        views.IncidentEscalationEvaluateView.as_view(),
        name="incident-escalation-evaluate",
    ),
]
