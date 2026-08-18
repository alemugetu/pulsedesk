"""
Notification Service —

Service layer for notification creation and management.

Responsibilities:
- Validate organization and recipient membership
- Resolve user notification preferences
- Create notification records
- Determine enabled delivery channels
- Coordinate with delivery dispatcher
- Enqueue asynchronous delivery via Celery

Design decisions:
- All business logic is kept in the service layer, not in API views.
- Delivery is enqueued after transaction commit to ensure data consistency.
- Critical notifications (SLA breaches, escalations) always include in-app delivery.
- User preferences are respected but can be overridden for critical events.
"""

from django.db import transaction
from organizations.models import Membership, MembershipStatus, Organization

from .delivery import DeliveryDispatcher
from .models import (
    Notification,
    NotificationPreference,
)


class NotificationService:
    """
    Service for creating and managing notifications.

    Coordinates the entire notification lifecycle from creation to delivery.
    """

    def __init__(self):
        self.dispatcher = DeliveryDispatcher()

    def create_notification(
        self,
        organization: Organization,
        recipient,
        notification_type: str,
        title: str,
        message: str,
        severity: str = "INFO",
        incident_id: str | None = None,
        escalation_event_id: str | None = None,
        force_delivery: bool = False,
    ) -> Notification:
        """
        Create a notification and enqueue delivery.

        Args:
            organization: The organization that owns the notification
            recipient: The user who should receive the notification
            notification_type: Type of notification (from NotificationType choices)
            title: Notification title
            message: Detailed notification message
            severity: Severity level (from NotificationSeverity choices)
            incident_id: Optional related incident ID
            escalation_event_id: Optional related escalation event ID
            force_delivery: If True, bypass user preferences and deliver to all channels

        Returns:
            The created Notification instance

        Raises:
            ValueError: If recipient is not a member of the organization
        """
        # Validate recipient membership
        if not self._validate_recipient_membership(organization, recipient):
            raise ValueError(
                f"User {recipient.email} is not a member of organization {organization.name}"
            )

        # Create notification record
        notification = Notification.objects.create(
            organization=organization,
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            severity=severity,
            incident_id=incident_id,
            escalation_event_id=escalation_event_id,
        )

        # Get user preferences for this organization
        preferences, _ = NotificationPreference.get_or_create(organization, recipient)

        # Determine enabled channels
        channels = self._determine_channels(
            preferences,
            notification_type,
            severity,
            force_delivery,
        )

        # Enqueue delivery after transaction commit
        transaction.on_commit(lambda: self._enqueue_delivery(notification.id, channels))

        # Publish realtime notification event for important notifications
        self._publish_notification_event(notification, incident_id)

        return notification

    def _validate_recipient_membership(
        self,
        organization: Organization,
        recipient,
    ) -> bool:
        """
        Validate that the recipient is an active member of the organization.

        Args:
            organization: The organization to check membership for
            recipient: The user to validate

        Returns:
            True if user is an active member, False otherwise
        """
        return Membership.objects.filter(
            organization=organization,
            user=recipient,
            status=MembershipStatus.ACTIVE,
        ).exists()

    def _determine_channels(
        self,
        preferences: NotificationPreference,
        notification_type: str,
        severity: str,
        force_delivery: bool,
    ) -> list[str]:
        """
        Determine which delivery channels should be used.

        Args:
            preferences: User's notification preferences
            notification_type: Type of notification
            severity: Severity level
            force_delivery: Whether to bypass preferences

        Returns:
            List of enabled channel identifiers
        """
        channels = []

        if force_delivery:
            # Force delivery: use all channels
            channels = ["EMAIL", "IN_APP"]
        else:
            # Respect user preferences
            if preferences.email_enabled:
                channels.append("EMAIL")
            if preferences.in_app_enabled:
                channels.append("IN_APP")

        # Critical notifications always include in-app delivery
        if severity == "CRITICAL" and "IN_APP" not in channels:
            channels.append("IN_APP")

        # Escalation events always include in-app delivery
        if notification_type == "ESCALATION_TRIGGERED" and "IN_APP" not in channels:
            channels.append("IN_APP")

        return channels

    def _enqueue_delivery(self, notification_id: str, channels: list[str]) -> None:
        """
        Enqueue asynchronous notification delivery via Celery.

        Args:
            notification_id: The notification ID to deliver
            channels: List of channels to deliver through
        """
        from .tasks import deliver_notification_task

        deliver_notification_task.delay(notification_id, channels)

    def _publish_notification_event(
        self,
        notification: Notification,
        incident_id: str | None,
    ) -> None:
        """
        Publish realtime notification event for important notifications.

        Only publishes for critical/important notification types to avoid noise.

        Args:
            notification: The notification that was created
            incident_id: Optional incident ID for context
        """
        # Only publish for important notification types
        important_types = {
            "SLA_BREACH",
            "ESCALATION_TRIGGERED",
            "INCIDENT_ASSIGNED",
        }

        if notification.notification_type not in important_types:
            return

        from realtime.services import RealtimeEventService

        try:
            # Get incident number if incident_id is provided
            incident_number = None
            if incident_id:
                from incidents.models import Incident

                try:
                    incident = Incident.objects.get(id=incident_id)
                    incident_number = incident.incident_number
                except Incident.DoesNotExist:
                    pass

            RealtimeEventService.publish_notification_created(
                notification_id=str(notification.id),
                notification_type=notification.notification_type,
                incident_id=incident_id,
                incident_number=incident_number,
                organization_id=str(notification.organization_id),
            )
        except Exception:
            # Log error but don't fail notification creation
            import logging

            logger = logging.getLogger(__name__)
            logger.exception(
                "Failed to publish notification event for notification %s",
                notification.id,
                extra={
                    "notification_id": str(notification.id),
                    "event": "realtime_error",
                },
            )

    def create_sla_warning_notification(
        self,
        organization: Organization,
        recipient,
        incident_id: str,
        incident_title: str,
        deadline_str: str,
    ) -> Notification:
        """
        Create an SLA warning notification.

        Args:
            organization: The organization
            recipient: The user to notify
            incident_id: The incident ID
            incident_title: The incident title
            deadline_str: Formatted deadline string

        Returns:
            The created Notification instance
        """
        title = f"SLA Warning: {incident_title}"
        message = (
            f"Incident {incident_id} is approaching its SLA deadline. "
            f"Deadline: {deadline_str}. Please acknowledge or resolve the incident."
        )

        return self.create_notification(
            organization=organization,
            recipient=recipient,
            notification_type="SLA_WARNING",
            title=title,
            message=message,
            severity="WARNING",
            incident_id=incident_id,
        )

    def create_sla_breach_notification(
        self,
        organization: Organization,
        recipient,
        incident_id: str,
        incident_title: str,
        deadline_str: str,
    ) -> Notification:
        """
        Create an SLA breach notification.

        Args:
            organization: The organization
            recipient: The user to notify
            incident_id: The incident ID
            incident_title: The incident title
            deadline_str: Formatted deadline string

        Returns:
            The created Notification instance
        """
        title = f"SLA Breached: {incident_title}"
        message = (
            f"Incident {incident_id} has breached its SLA deadline. "
            f"Deadline was: {deadline_str}. Immediate attention required."
        )

        return self.create_notification(
            organization=organization,
            recipient=recipient,
            notification_type="SLA_BREACH",
            title=title,
            message=message,
            severity="CRITICAL",
            incident_id=incident_id,
            force_delivery=True,  # Force delivery for critical SLA breaches
        )

    def create_escalation_notification(
        self,
        organization: Organization,
        recipient,
        escalation_event_id: str,
        incident_id: str,
        incident_title: str,
        escalation_level: int,
        target_type: str,
    ) -> Notification:
        """
        Create an escalation triggered notification.

        Args:
            organization: The organization
            recipient: The user to notify
            escalation_event_id: The escalation event ID
            incident_id: The incident ID
            incident_title: The incident title
            escalation_level: The escalation level number
            target_type: The escalation target type

        Returns:
            The created Notification instance
        """
        title = f"Escalation Level {escalation_level}: {incident_title}"
        message = (
            f"Incident {incident_id} has escalated to level {escalation_level}. "
            f"Target: {target_type}. Please take appropriate action."
        )

        return self.create_notification(
            organization=organization,
            recipient=recipient,
            notification_type="ESCALATION_TRIGGERED",
            title=title,
            message=message,
            severity="CRITICAL",
            incident_id=incident_id,
            escalation_event_id=escalation_event_id,
            force_delivery=True,  # Force delivery for escalations
        )
