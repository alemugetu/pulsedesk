from django.contrib import admin

from .models import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
    NotificationSeverity,
    NotificationType,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "notification_type",
        "title",
        "severity",
        "recipient",
        "organization",
        "is_read",
        "created_at",
    ]
    list_filter = [
        "notification_type",
        "severity",
        "is_read",
        "organization",
        "created_at",
    ]
    search_fields = ["title", "message", "recipient__email", "incident_id"]
    readonly_fields = ["created_at", "updated_at", "read_at"]
    ordering = ["-created_at"]


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "notification",
        "channel",
        "status",
        "retry_count",
        "delivered_at",
        "created_at",
    ]
    list_filter = ["channel", "status", "created_at"]
    search_fields = ["notification__title", "error_message"]
    readonly_fields = ["created_at", "updated_at", "delivered_at"]
    ordering = ["-created_at"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "organization",
        "email_enabled",
        "in_app_enabled",
        "created_at",
    ]
    list_filter = ["email_enabled", "in_app_enabled", "organization"]
    search_fields = ["user__email", "organization__name"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]
