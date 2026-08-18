from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

# ---------------------------------------------------------------------------
# Documentation URL patterns — available in all environments.
# Review your security policy before exposing these in production.
# ---------------------------------------------------------------------------
_doc_urlpatterns = [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("api_v1.urls")),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/organizations/", include("organizations.urls")),
    path("api/v1/notifications/", include("notifications.urls")),
    *_doc_urlpatterns,
]
