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
    # Member list
    path(
        "<uuid:organization_id>/members/",
        views.OrganizationMemberListView.as_view(),
        name="organization-members",
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
]
