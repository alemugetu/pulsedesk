from django.urls import path
from settings import views

app_name = "settings"

urlpatterns = [
    path(
        "settings/",
        views.OrganizationSettingsDetailView.as_view(),
        name="organization-settings",
    ),
]
