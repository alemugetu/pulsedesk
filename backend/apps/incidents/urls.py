from django.urls import path
from incidents import views

app_name = "incidents"

urlpatterns = [
    # Incident categories list / create
    path(
        "incident-categories/",
        views.IncidentCategoryListCreateView.as_view(),
        name="category-list",
    ),
    # Incident category detail / update
    path(
        "incident-categories/<uuid:category_id>/",
        views.IncidentCategoryDetailView.as_view(),
        name="category-detail",
    ),
    # Incidents list / create
    path(
        "incidents/",
        views.IncidentListCreateView.as_view(),
        name="incident-list",
    ),
    # Incident detail / patch
    path(
        "incidents/<uuid:incident_id>/",
        views.IncidentDetailView.as_view(),
        name="incident-detail",
    ),
]
