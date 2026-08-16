"""
Delivery Abstraction Layer — Phase 10

Provides a clean separation between notification business logic and delivery mechanisms.
Each delivery channel is implemented as an adapter that can be extended without modifying
the notification service.

Architecture:
  NotificationService
      ↓
  DeliveryDispatcher
      ↓
  DeliveryAdapter (interface)
      ↓
  EmailDeliveryAdapter | InAppDeliveryAdapter
"""

from abc import ABC, abstractmethod
from typing import Optional

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

from .models import (
    DeliveryChannel,
    DeliveryStatus,
    Notification,
    NotificationDelivery,
)


class DeliveryAdapter(ABC):
    """
    Abstract base class for delivery adapters.

    Each delivery channel (email, in-app, etc.) implements this interface.
    This allows new channels to be added without modifying the notification service.
    """

    @abstractmethod
    def deliver(self, notification: Notification, delivery: NotificationDelivery) -> bool:
        """
        Deliver a notification through this channel.

        Args:
            notification: The notification to deliver
            delivery: The delivery record to update

        Returns:
            True if delivery succeeded, False otherwise
        """
        pass

    @abstractmethod
    def get_channel(self) -> str:
        """Return the delivery channel identifier."""
        pass


class EmailDeliveryAdapter(DeliveryAdapter):
    """
    Email delivery adapter using Django's send_mail.

    Reuses the existing email infrastructure and configuration.
    """

    def get_channel(self) -> str:
        return DeliveryChannel.EMAIL

    def deliver(self, notification: Notification, delivery: NotificationDelivery) -> bool:
        """
        Deliver notification via email.

        Args:
            notification: The notification to deliver
            delivery: The delivery record to update

        Returns:
            True if email was sent successfully, False otherwise
        """
        try:
            # Determine email template based on notification type
            template_prefix = self._get_template_prefix(notification.notification_type)

            # Prepare context for email template
            context = self._build_email_context(notification)

            # Render email content
            html_content = render_to_string(
                f"emails/notifications/{template_prefix}.html",
                context,
            )
            text_content = render_to_string(
                f"emails/notifications/{template_prefix}.txt",
                context,
            )

            # Send email
            subject = f"[{notification.severity}] {notification.title} - PulseDesk"
            send_mail(
                subject=subject,
                message=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[notification.recipient.email],
                html_message=html_content,
                fail_silently=False,
            )

            return True

        except Exception as e:
            # Log error and return failure
            delivery.mark_as_failed(str(e))
            return False

    def _get_template_prefix(self, notification_type: str) -> str:
        """Get the template prefix for a notification type."""
        template_mapping = {
            "SLA_WARNING": "sla_warning",
            "SLA_BREACH": "sla_breach",
            "ESCALATION_TRIGGERED": "escalation_triggered",
        }
        return template_mapping.get(notification_type, "notification")

    def _build_email_context(self, notification: Notification) -> dict:
        """Build context dictionary for email templates."""
        backend_url = getattr(settings, "BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

        context = {
            "notification": notification,
            "recipient": notification.recipient,
            "organization": notification.organization,
            "backend_url": backend_url,
            "severity": notification.severity,
            "title": notification.title,
            "message": notification.message,
            "incident_id": notification.incident_id,
            "escalation_event_id": notification.escalation_event_id,
        }

        # Add incident URL if incident is referenced
        if notification.incident_id:
            context["incident_url"] = f"{backend_url}/incidents/{notification.incident_id}/"

        return context


class InAppDeliveryAdapter(DeliveryAdapter):
    """
    In-app delivery adapter.

    In-app notifications are stored in the database as the Notification record itself.
    Delivery is "complete" when the notification record exists and is accessible to the user.
    """

    def get_channel(self) -> str:
        return DeliveryChannel.IN_APP

    def deliver(self, notification: Notification, delivery: NotificationDelivery) -> bool:
        """
        Deliver notification via in-app storage.

        Since the notification record already exists in the database,
        in-app delivery is essentially complete when the notification is created.
        This adapter validates the delivery and marks it as sent.

        Args:
            notification: The notification to deliver
            delivery: The delivery record to update

        Returns:
            True (in-app delivery always succeeds if notification exists)
        """
        try:
            # Validate that the notification exists and is accessible
            # The notification record is the in-app delivery mechanism
            if not notification.pk:
                raise ValueError("Notification must be saved before in-app delivery")

            # In-app delivery is complete when notification exists
            return True

        except Exception as e:
            # Log error and return failure
            delivery.mark_as_failed(str(e))
            return False


class DeliveryDispatcher:
    """
    Coordinates delivery across multiple channels.

    Uses the adapter pattern to deliver notifications through enabled channels.
    Handles delivery status tracking and error management.
    """

    def __init__(self):
        self._adapters = {
            DeliveryChannel.EMAIL: EmailDeliveryAdapter(),
            DeliveryChannel.IN_APP: InAppDeliveryAdapter(),
        }

    def register_adapter(self, channel: str, adapter: DeliveryAdapter) -> None:
        """Register a new delivery adapter for a channel."""
        self._adapters[channel] = adapter

    def deliver(self, notification: Notification, channels: list[str]) -> dict[str, bool]:
        """
        Deliver a notification through multiple channels.

        Args:
            notification: The notification to deliver
            channels: List of channel identifiers to deliver through

        Returns:
            Dictionary mapping channel names to delivery success (True/False)
        """
        results = {}

        for channel in channels:
            adapter = self._adapters.get(channel)
            if not adapter:
                results[channel] = False
                continue

            # Get or create delivery record
            delivery, created = NotificationDelivery.objects.get_or_create(
                notification=notification,
                channel=channel,
                defaults={
                    "status": DeliveryStatus.PENDING,
                },
            )

            # Skip if already successfully delivered
            if not created and delivery.status == DeliveryStatus.SENT:
                results[channel] = True
                continue

            # Attempt delivery
            try:
                success = adapter.deliver(notification, delivery)

                if success:
                    delivery.mark_as_sent()
                else:
                    # Adapter already marked as failed
                    pass

                results[channel] = success

            except Exception as e:
                # Unexpected error
                delivery.mark_as_failed(str(e))
                results[channel] = False

        return results

    def deliver_single(self, notification: Notification, channel: str) -> bool:
        """
        Deliver a notification through a single channel.

        Args:
            notification: The notification to deliver
            channel: The channel identifier

        Returns:
            True if delivery succeeded, False otherwise
        """
        results = self.deliver(notification, [channel])
        return results.get(channel, False)
