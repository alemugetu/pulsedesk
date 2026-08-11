from django.urls import path

from . import views

app_name = "api_v1"

urlpatterns = [
    # API root
    path("", views.APIRootView.as_view(), name="root"),
    # Health check endpoint
    path("health/", views.HealthCheckView.as_view(), name="health"),
]
