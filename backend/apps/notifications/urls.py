from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "notifications"

router = DefaultRouter()
router.register(r"", views.NotificationViewSet, basename="notification")
router.register(
    r"preferences",
    views.NotificationPreferenceViewSet,
    basename="notificationpreference",
)

urlpatterns = [
    path("", include(router.urls)),
]
