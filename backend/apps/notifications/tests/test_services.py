"""
Tests for Notification Service — Phase 10

Tests:
- NotificationService creation
- Recipient validation
- Preference handling
- Delivery channel determination
- SLA warning notification creation
- SLA breach notification creation
- Escalation notification creation
"""

from accounts.models import User
from django.test import TestCase
from notifications.models import (
    DeliveryChannel,
    NotificationPreference,
    NotificationSeverity,
    NotificationType,
)
from notifications.services import NotificationService
from organizations.models import Membership, Organization


class NotificationServiceTest(TestCase):
    """Test NotificationService functionality."""

    def setUp(self):
        """Set up test data."""
        self.organization = Organization.objects.create(
            name="Test Organization",
            slug="test-org",
        )
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.membership = Membership.objects.create(
            organization=self.organization,
            user=self.user,
            status="ACTIVE",
        )
        self.service = NotificationService()

    def test_create_notification_success(self):
        """Test successful notification creation."""
        notification = self.service.create_notification(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification",
            message="Test message",
            severity=NotificationSeverity.WARNING,
        )

        self.assertEqual(notification.organization, self.organization)
        self.assertEqual(notification.recipient, self.user)
        self.assertEqual(notification.notification_type, NotificationType.SLA_WARNING)
        self.assertEqual(notification.title, "Test Notification")
        self.assertEqual(notification.message, "Test message")
        self.assertEqual(notification.severity, NotificationSeverity.WARNING)

    def test_create_notification_invalid_recipient(self):
        """Test notification creation with non-member recipient."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )

        with self.assertRaises(ValueError) as context:
            self.service.create_notification(
                organization=self.organization,
                recipient=other_user,
                notification_type=NotificationType.SLA_WARNING,
                title="Test Notification",
                message="Test message",
            )

        self.assertIn("not a member", str(context.exception))

    def test_create_notification_with_incident_reference(self):
        """Test notification creation with incident reference."""
        notification = self.service.create_notification(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification",
            message="Test message",
            incident_id="test-incident-id",
        )

        self.assertEqual(notification.incident_id, "test-incident-id")

    def test_create_notification_with_escalation_reference(self):
        """Test notification creation with escalation event reference."""
        notification = self.service.create_notification(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.ESCALATION_TRIGGERED,
            title="Test Notification",
            message="Test message",
            escalation_event_id="test-escalation-id",
        )

        self.assertEqual(notification.escalation_event_id, "test-escalation-id")

    def test_create_sla_warning_notification(self):
        """Test SLA warning notification creation."""
        notification = self.service.create_sla_warning_notification(
            organization=self.organization,
            recipient=self.user,
            incident_id="test-incident-id",
            incident_title="Test Incident",
            deadline_str="2024-01-01 12:00:00 UTC",
        )

        self.assertEqual(notification.notification_type, NotificationType.SLA_WARNING)
        self.assertEqual(notification.severity, NotificationSeverity.WARNING)
        self.assertEqual(notification.incident_id, "test-incident-id")
        self.assertIn("SLA Warning", notification.title)
        self.assertIn("Test Incident", notification.title)

    def test_create_sla_breach_notification(self):
        """Test SLA breach notification creation."""
        notification = self.service.create_sla_breach_notification(
            organization=self.organization,
            recipient=self.user,
            incident_id="test-incident-id",
            incident_title="Test Incident",
            deadline_str="2024-01-01 12:00:00 UTC",
        )

        self.assertEqual(notification.notification_type, NotificationType.SLA_BREACH)
        self.assertEqual(notification.severity, NotificationSeverity.CRITICAL)
        self.assertEqual(notification.incident_id, "test-incident-id")
        self.assertIn("SLA Breached", notification.title)
        self.assertIn("Test Incident", notification.title)

    def test_create_escalation_notification(self):
        """Test escalation notification creation."""
        notification = self.service.create_escalation_notification(
            organization=self.organization,
            recipient=self.user,
            escalation_event_id="test-escalation-id",
            incident_id="test-incident-id",
            incident_title="Test Incident",
            escalation_level=2,
            target_type="ROLE",
        )

        self.assertEqual(
            notification.notification_type, NotificationType.ESCALATION_TRIGGERED
        )
        self.assertEqual(notification.severity, NotificationSeverity.CRITICAL)
        self.assertEqual(notification.escalation_event_id, "test-escalation-id")
        self.assertEqual(notification.incident_id, "test-incident-id")
        self.assertIn("Escalation Level 2", notification.title)
        self.assertIn("Test Incident", notification.title)

    def test_channel_determination_with_preferences(self):
        """Test channel determination based on user preferences."""
        # Create preference with email disabled
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
            email_enabled=False,
            in_app_enabled=True,
        )

        channels = self.service._determine_channels(
            preference,
            NotificationType.SLA_WARNING,
            NotificationSeverity.WARNING,
            force_delivery=False,
        )

        self.assertEqual(channels, [DeliveryChannel.IN_APP])

    def test_channel_determination_force_delivery(self):
        """Test channel determination with force delivery."""
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
            email_enabled=False,
            in_app_enabled=False,
        )

        channels = self.service._determine_channels(
            preference,
            NotificationType.SLA_BREACH,
            NotificationSeverity.CRITICAL,
            force_delivery=True,
        )

        self.assertEqual(set(channels), {DeliveryChannel.EMAIL, DeliveryChannel.IN_APP})

    def test_critical_notification_always_includes_in_app(self):
        """Test that critical notifications always include in-app delivery."""
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
            email_enabled=True,
            in_app_enabled=False,
        )

        channels = self.service._determine_channels(
            preference,
            NotificationType.SLA_BREACH,
            NotificationSeverity.CRITICAL,
            force_delivery=False,
        )

        self.assertIn(DeliveryChannel.IN_APP, channels)

    def test_escalation_notification_always_includes_in_app(self):
        """Test that escalation notifications always include in-app delivery."""
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
            email_enabled=True,
            in_app_enabled=False,
        )

        channels = self.service._determine_channels(
            preference,
            NotificationType.ESCALATION_TRIGGERED,
            NotificationSeverity.CRITICAL,
            force_delivery=False,
        )

        self.assertIn(DeliveryChannel.IN_APP, channels)

    def test_validate_recipient_membership(self):
        """Test recipient membership validation."""
        # Valid membership
        is_valid = self.service._validate_recipient_membership(
            self.organization, self.user
        )
        self.assertTrue(is_valid)

        # Invalid membership
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        is_valid = self.service._validate_recipient_membership(
            self.organization, other_user
        )
        self.assertFalse(is_valid)

    def test_validate_recipient_membership_inactive(self):
        """Test that inactive membership is rejected."""
        # Create inactive membership
        Membership.objects.create(
            organization=self.organization,
            user=self.user,
            status="SUSPENDED",
        )

        is_valid = self.service._validate_recipient_membership(
            self.organization, self.user
        )
        self.assertFalse(is_valid)
