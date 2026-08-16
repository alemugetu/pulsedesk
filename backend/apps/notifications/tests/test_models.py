"""
Tests for Notification Models — Phase 10

Tests:
- Notification model organization ownership
- Notification model recipient validation
- Notification model read state
- NotificationDelivery model uniqueness
- NotificationPreference model defaults
- Multi-tenant isolation
"""

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from notifications.models import (
    DeliveryChannel,
    DeliveryStatus,
    Notification,
    NotificationDelivery,
    NotificationPreference,
    NotificationSeverity,
    NotificationType,
)
from organizations.models import Membership, Organization


class NotificationModelTest(TestCase):
    """Test Notification model functionality."""

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

    def test_notification_creation(self):
        """Test creating a notification."""
        notification = Notification.objects.create(
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
        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)

    def test_notification_mark_as_read(self):
        """Test marking notification as read."""
        notification = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification",
            message="Test message",
        )

        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)

        notification.mark_as_read()

        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_notification_mark_as_unread(self):
        """Test marking notification as unread."""
        notification = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification",
            message="Test message",
        )

        notification.mark_as_read()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

        notification.mark_as_unread()
        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)

    def test_notification_organization_isolation(self):
        """Test that notifications are organization-scoped."""
        org2 = Organization.objects.create(
            name="Test Organization 2",
            slug="test-org-2",
        )
        user2 = User.objects.create_user(
            email="test2@example.com",
            password="testpass123",
        )
        Membership.objects.create(
            organization=org2,
            user=user2,
            status="ACTIVE",
        )

        # Create notification for org1
        notification = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification",
            message="Test message",
        )

        # User from org2 should not see org1 notifications
        org2_notifications = Notification.objects.filter(
            organization=org2
        )
        self.assertEqual(org2_notifications.count(), 0)

        # User from org1 should see org1 notifications
        org1_notifications = Notification.objects.filter(
            organization=self.organization
        )
        self.assertEqual(org1_notifications.count(), 1)


class NotificationDeliveryModelTest(TestCase):
    """Test NotificationDelivery model functionality."""

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
        self.notification = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification",
            message="Test message",
        )

    def test_delivery_creation(self):
        """Test creating a delivery record."""
        delivery = NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.PENDING,
        )

        self.assertEqual(delivery.notification, self.notification)
        self.assertEqual(delivery.channel, DeliveryChannel.EMAIL)
        self.assertEqual(delivery.status, DeliveryStatus.PENDING)
        self.assertEqual(delivery.retry_count, 0)

    def test_delivery_uniqueness_constraint(self):
        """Test that delivery uniqueness is enforced per channel."""
        # Create first delivery
        NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.PENDING,
        )

        # Attempt to create duplicate - should fail
        with self.assertRaises(Exception):  # IntegrityError
            NotificationDelivery.objects.create(
                notification=self.notification,
                channel=DeliveryChannel.EMAIL,
                status=DeliveryStatus.PENDING,
            )

    def test_delivery_mark_as_sent(self):
        """Test marking delivery as sent."""
        delivery = NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.PENDING,
        )

        self.assertEqual(delivery.status, DeliveryStatus.PENDING)
        self.assertIsNone(delivery.delivered_at)

        delivery.mark_as_sent()

        self.assertEqual(delivery.status, DeliveryStatus.SENT)
        self.assertIsNotNone(delivery.delivered_at)

    def test_delivery_mark_as_failed(self):
        """Test marking delivery as failed."""
        delivery = NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.PENDING,
        )

        delivery.mark_as_failed("SMTP error")

        self.assertEqual(delivery.status, DeliveryStatus.FAILED)
        self.assertEqual(delivery.error_message, "SMTP error")

    def test_delivery_increment_retry(self):
        """Test incrementing retry count."""
        delivery = NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.PENDING,
        )

        self.assertEqual(delivery.retry_count, 0)

        delivery.increment_retry()
        self.assertEqual(delivery.retry_count, 1)

        delivery.increment_retry()
        self.assertEqual(delivery.retry_count, 2)

    def test_multiple_channels_per_notification(self):
        """Test that a notification can have multiple delivery channels."""
        email_delivery = NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.SENT,
        )
        in_app_delivery = NotificationDelivery.objects.create(
            notification=self.notification,
            channel=DeliveryChannel.IN_APP,
            status=DeliveryStatus.SENT,
        )

        self.assertEqual(self.notification.deliveries.count(), 2)
        self.assertEqual(
            self.notification.deliveries.filter(channel=DeliveryChannel.EMAIL).count(),
            1,
        )
        self.assertEqual(
            self.notification.deliveries.filter(channel=DeliveryChannel.IN_APP).count(),
            1,
        )


class NotificationPreferenceModelTest(TestCase):
    """Test NotificationPreference model functionality."""

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

    def test_preference_defaults(self):
        """Test that preferences have safe defaults."""
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
        )

        self.assertTrue(preference.email_enabled)
        self.assertTrue(preference.in_app_enabled)

    def test_preference_uniqueness_constraint(self):
        """Test that preference uniqueness is enforced per org/user."""
        # Create first preference
        NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
        )

        # Attempt to create duplicate - should fail
        with self.assertRaises(Exception):  # IntegrityError
            NotificationPreference.objects.create(
                organization=self.organization,
                user=self.user,
            )

    def test_preference_get_or_create(self):
        """Test get_or_create method."""
        # First call should create
        preference, created = NotificationPreference.get_or_create(
            self.organization, self.user
        )
        self.assertTrue(created)
        self.assertTrue(preference.email_enabled)
        self.assertTrue(preference.in_app_enabled)

        # Second call should retrieve existing
        preference2, created2 = NotificationPreference.get_or_create(
            self.organization, self.user
        )
        self.assertFalse(created2)
        self.assertEqual(preference.id, preference2.id)

    def test_preference_is_channel_enabled(self):
        """Test channel enabled check."""
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
            email_enabled=True,
            in_app_enabled=False,
        )

        self.assertTrue(preference.is_channel_enabled(DeliveryChannel.EMAIL))
        self.assertFalse(preference.is_channel_enabled(DeliveryChannel.IN_APP))

    def test_preference_organization_isolation(self):
        """Test that preferences are organization-scoped."""
        org2 = Organization.objects.create(
            name="Test Organization 2",
            slug="test-org-2",
        )

        # Create preference for org1
        preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
        )

        # User should have different preferences for different organizations
        preference2 = NotificationPreference.objects.create(
            organization=org2,
            user=self.user,
            email_enabled=False,
        )

        self.assertNotEqual(preference.id, preference2.id)
        self.assertTrue(preference.email_enabled)
        self.assertFalse(preference2.email_enabled)
