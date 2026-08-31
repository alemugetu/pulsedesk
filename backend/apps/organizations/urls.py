from django.urls import include, path
from organizations import views

app_name = "organizations"

urlpatterns = [
    # Organization list / create
    path("", views.OrganizationListCreateView.as_view(), name="organization-list"),
    # Organization detail
    path(
        "<uuid:organization_id>/",
        views.OrganizationDetailView.as_view(),
        name="organization-detail",
    ),
    # Member list / add member
    path(
        "<uuid:organization_id>/members/",
        views.OrganizationMemberListView.as_view(),
        name="organization-members",
    ),
    # Member detail (get, status update / suspend, remove)
    path(
        "<uuid:organization_id>/members/<uuid:membership_id>/",
        views.MembershipDetailView.as_view(),
        name="membership-detail",
    ),
    # Membership role assignment
    path(
        "<uuid:organization_id>/members/<uuid:membership_id>/role/",
        views.MembershipRoleAssignView.as_view(),
        name="membership-role-assign",
    ),
    # Role list / create
    path(
        "<uuid:organization_id>/roles/",
        views.RoleListCreateView.as_view(),
        name="role-list",
    ),
    # Role detail / update / delete
    path(
        "<uuid:organization_id>/roles/<uuid:role_id>/",
        views.RoleDetailView.as_view(),
        name="role-detail",
    ),
    # Incidents & Incident Categories
    path(
        "<uuid:organization_id>/",
        include("incidents.urls"),
    ),
    # SLA Policies & Targets
    path(
        "<uuid:organization_id>/",
        include("sla.urls"),
    ),
    # Escalation Policies, Levels, Rules & Incident Escalation History
    path(
        "<uuid:organization_id>/",
        include("escalation.urls"),
    ),
    # Operations Dashboard (Phase 11)
    path(
        "<uuid:organization_id>/dashboard/",
        include("dashboard.urls"),
    ),
    # Incident Comments (Phase 13.1)
    path(
        "<uuid:organization_id>/",
        include("comments.urls"),
    ),
    # Incident Attachments (Phase 13.2)
    path(
        "<uuid:organization_id>/",
        include("attachments.urls"),
    ),
    # Audit Logs (Phase 13.3)
    path(
        "<uuid:organization_id>/",
        include("audit_logs.urls"),
    ),
    # Reports (Phase 13.5)
    path(
        "<uuid:organization_id>/reports/",
        include("reports.urls"),
    ),
    # Organization Settings (Phase 13.6)
    path(
        "<uuid:organization_id>/",
        include("settings.urls"),
    ),
]
