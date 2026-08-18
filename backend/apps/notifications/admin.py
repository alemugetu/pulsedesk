from typing import ClassVar

from django.contrib import admin

from .models import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = [
        "id",
        "notification_type",
        "title",
        "severity",
        "recipient",
        "organization",
        "is_read",
        "created_at",
    ]
    list_filter: ClassVar[list[str]] = [
        "notification_type",
        "severity",
        "is_read",
        "organization",
        "created_at",
    ]
    search_fields: ClassVar[list[str]] = [
        "title",
        "message",
        "recipient__email",
        "incident_id",
    ]
    readonly_fields: ClassVar[list[str]] = ["created_at", "updated_at", "read_at"]
    ordering: ClassVar[list[str]] = ["-created_at"]


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = [
        "id",
        "notification",
        "channel",
        "status",
        "retry_count",
        "delivered_at",
        "created_at",
    ]
    list_filter: ClassVar[list[str]] = ["channel", "status", "created_at"]
    search_fields: ClassVar[list[str]] = ["notification__title", "error_message"]
    readonly_fields: ClassVar[list[str]] = ["created_at", "updated_at", "delivered_at"]
    ordering: ClassVar[list[str]] = ["-created_at"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = [
        "id",
        "user",
        "organization",
        "email_enabled",
        "in_app_enabled",
        "created_at",
    ]
    list_filter: ClassVar[list[str]] = [
        "email_enabled",
        "in_app_enabled",
        "organization",
    ]
    search_fields: ClassVar[list[str]] = ["user__email", "organization__name"]
    readonly_fields: ClassVar[list[str]] = ["created_at", "updated_at"]
    ordering: ClassVar[list[str]] = ["-created_at"]
