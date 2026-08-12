from django.urls import path
from sla import views

app_name = "sla"

urlpatterns = [
    # SLA Policy list / create
    path(
        "sla-policies/",
        views.SLAPolicyListCreateView.as_view(),
        name="policy-list",
    ),
    # SLA Policy detail / update
    path(
        "sla-policies/<uuid:policy_id>/",
        views.SLAPolicyDetailView.as_view(),
        name="policy-detail",
    ),
    # SLA Target list / create
    path(
        "sla-policies/<uuid:policy_id>/targets/",
        views.SLATargetListCreateView.as_view(),
        name="target-list",
    ),
    # SLA Target detail / update
    path(
        "sla-policies/<uuid:policy_id>/targets/<uuid:target_id>/",
        views.SLATargetDetailView.as_view(),
        name="target-detail",
    ),
]
