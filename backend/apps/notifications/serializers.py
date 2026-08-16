from typing import ClassVar

from rest_framework import serializers

from .models import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
    NotificationSeverity,
    NotificationType,
)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notification list and detail views."""

    class Meta:
        model = Notification
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "organization",
            "recipient",
            "notification_type",
            "title",
            "message",
            "severity",
            "incident_id",
            "escalation_event_id",
            "is_read",
            "read_at",
            "created_at",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = fields


class NotificationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for notification list views."""

    class Meta:
        model = Notification
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "notification_type",
            "title",
            "severity",
            "is_read",
            "created_at",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for user notification preferences."""

    class Meta:
        model = NotificationPreference
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "organization",
            "user",
            "email_enabled",
            "in_app_enabled",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = ("id", "organization", "user")


class NotificationPreferenceUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating notification preferences."""

    class Meta:
        model = NotificationPreference
        fields: ClassVar[tuple[str, ...]] = (
            "email_enabled",
            "in_app_enabled",
        )


class MarkNotificationReadSerializer(serializers.Serializer):
    """Serializer for marking a notification as read."""

    is_read = serializers.BooleanField(required=True)


class MarkAllNotificationsReadSerializer(serializers.Serializer):
    """Serializer for marking all notifications as read."""

    pass  # No fields needed, just the action
