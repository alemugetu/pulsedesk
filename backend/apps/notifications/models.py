"""
Notification & Delivery Engine 

Domain architecture:
  Organization
    └── Notification (organization-scoped notifications)
          ├── NotificationDelivery (per-channel delivery tracking)
          └── NotificationPreference (user notification preferences per organization)

Design decisions:
- Notifications are organization-scoped for strict multi-tenant isolation.
- Each notification has exactly one recipient (user) within the organization.
- NotificationDelivery tracks delivery status per channel (email, in-app).
- NotificationPreference allows users to control which channels they receive.
- Delivery is asynchronous via Celery to avoid blocking HTTP requests.
- Idempotency is enforced by UniqueConstraint on (notification, channel) for delivery.
- Critical operational notifications (SLA breaches, escalations) are always delivered in-app.
- Email delivery can fail without affecting in-app notification availability.
"""

from typing import ClassVar

from common.models import BaseModel
from django.conf import settings
from django.db import models
from organizations.models import Organization

# ---------------------------------------------------------------------------
# Choices and Enums
# ---------------------------------------------------------------------------


class NotificationType(models.TextChoices):
    """Controlled set of notification types for operational events."""

    SLA_WARNING = "SLA_WARNING", "SLA Warning"
    SLA_BREACH = "SLA_BREACH", "SLA Breach"
    ESCALATION_TRIGGERED = "ESCALATION_TRIGGERED", "Escalation Triggered"


class NotificationSeverity(models.TextChoices):
    """Severity classification for notifications."""

    INFO = "INFO", "Info"
    WARNING = "WARNING", "Warning"
    CRITICAL = "CRITICAL", "Critical"


class DeliveryChannel(models.TextChoices):
    """Available delivery channels."""

    EMAIL = "EMAIL", "Email"
    IN_APP = "IN_APP", "In-App"


class DeliveryStatus(models.TextChoices):
    """Delivery lifecycle status."""

    PENDING = "PENDING", "Pending"
    SENT = "SENT", "Sent"
    FAILED = "FAILED", "Failed"


# ---------------------------------------------------------------------------
# Notification Models
# ---------------------------------------------------------------------------


class Notification(BaseModel):
    """
    Organization-scoped notification for a specific recipient.

    Represents an operational event that needs to be communicated to a user.
    Related objects (incidents, escalations) are referenced via content type
    for flexibility while maintaining type safety.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="notifications",
        help_text="Organization that owns this notification.",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        help_text="User who should receive this notification.",
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        help_text="Type of notification event.",
    )
    title = models.CharField(
        max_length=255,
        help_text="Notification title.",
    )
    message = models.TextField(
        help_text="Detailed notification message.",
    )
    severity = models.CharField(
        max_length=20,
        choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
        help_text="Severity level of the notification.",
    )

    # Related object references (optional, for context)
    incident_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Related incident ID if applicable.",
    )
    escalation_event_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Related escalation event ID if applicable.",
    )

    # Read state
    is_read = models.BooleanField(
        default=False,
        help_text="Whether the notification has been read.",
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the notification was marked as read.",
    )

    class Meta:
        db_table = "notifications"
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering: ClassVar = ["-created_at"]
        indexes: ClassVar = [
            models.Index(fields=["organization"]),
            models.Index(fields=["recipient"]),
            models.Index(fields=["organization", "recipient"]),
            models.Index(fields=["organization", "is_read"]),
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["notification_type"]),
            models.Index(fields=["severity"]),
            models.Index(fields=["created_at"]),
            # Composite indexes for common query patterns
            models.Index(
                fields=["organization", "recipient", "is_read"],
                name="notif_org_recipient_read_idx",
            ),
            models.Index(
                fields=["organization", "created_at"],
                name="notif_org_created_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.notification_type}: {self.title} ({self.recipient.email})"

    def mark_as_read(self) -> None:
        """Mark notification as read with timestamp."""
        from django.utils import timezone

        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def mark_as_unread(self) -> None:
        """Mark notification as unread and clear read timestamp."""
        if self.is_read:
            self.is_read = False
            self.read_at = None
            self.save(update_fields=["is_read", "read_at"])


class NotificationDelivery(BaseModel):
    """
    Per-channel delivery tracking for a notification.

    Each notification can have multiple delivery records (one per channel).
    This allows partial delivery failures (e.g., email fails but in-app succeeds).
    Idempotency is enforced by UniqueConstraint on (notification, channel).
    """

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="deliveries",
        help_text="The notification being delivered.",
    )
    channel = models.CharField(
        max_length=20,
        choices=DeliveryChannel.choices,
        help_text="Delivery channel used.",
    )
    status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
        help_text="Current delivery status.",
    )
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="Error details if delivery failed.",
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when delivery was completed.",
    )
    retry_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of delivery retry attempts.",
    )

    class Meta:
        db_table = "notification_deliveries"
        verbose_name = "Notification Delivery"
        verbose_name_plural = "Notification Deliveries"
        ordering: ClassVar = ["-created_at"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["notification", "channel"],
                name="unique_notification_delivery_per_channel",
            )
        ]
        indexes: ClassVar = [
            models.Index(fields=["notification"]),
            models.Index(fields=["channel"]),
            models.Index(fields=["status"]),
            models.Index(fields=["notification", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.notification_id} / {self.channel} ({self.status})"

    def mark_as_sent(self) -> None:
        """Mark delivery as successfully sent."""
        from django.utils import timezone

        self.status = DeliveryStatus.SENT
        self.delivered_at = timezone.now()
        self.save(update_fields=["status", "delivered_at"])

    def mark_as_failed(self, error_message: str = "") -> None:
        """Mark delivery as failed with error details."""
        self.status = DeliveryStatus.FAILED
        self.error_message = error_message
        self.save(update_fields=["status", "error_message"])

    def increment_retry(self) -> None:
        """Increment retry count."""
        self.retry_count += 1
        self.save(update_fields=["retry_count"])


class NotificationPreference(BaseModel):
    """
    User notification preferences per organization.

    Allows users to control which channels they receive notifications on.
    Preferences are organization-scoped to respect multi-tenant membership.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
        help_text="Organization for these preferences.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
        help_text="User who owns these preferences.",
    )
    email_enabled = models.BooleanField(
        default=True,
        help_text="Whether email notifications are enabled.",
    )
    in_app_enabled = models.BooleanField(
        default=True,
        help_text="Whether in-app notifications are enabled.",
    )

    class Meta:
        db_table = "notification_preferences"
        verbose_name = "Notification Preference"
        verbose_name_plural = "Notification Preferences"
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="unique_notification_preference_per_org_user",
            )
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "user"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} @ {self.organization.name} (email={self.email_enabled}, in_app={self.in_app_enabled})"

    @classmethod
    def get_or_create(cls, organization, user):
        """Get or create notification preferences for a user in an organization."""
        preference, _ = cls.objects.get_or_create(
            organization=organization,
            user=user,
            defaults={
                "email_enabled": True,
                "in_app_enabled": True,
            },
        )
        return preference

    def is_channel_enabled(self, channel: str) -> bool:
        """Check if a specific channel is enabled."""
        if channel == DeliveryChannel.EMAIL:
            return self.email_enabled
        elif channel == DeliveryChannel.IN_APP:
            return self.in_app_enabled
        return False
