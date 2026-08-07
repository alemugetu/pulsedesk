from django.urls import path
from organizations import views

app_name = 'organizations'

urlpatterns = [
    path('', views.OrganizationListCreateView.as_view(), name='organization-list'),
    path(
        '<uuid:organization_id>/',
        views.OrganizationDetailView.as_view(),
        name='organization-detail',
    ),
    path(
        '<uuid:organization_id>/members/',
        views.OrganizationMemberListView.as_view(),
        name='organization-members',
    ),
]
