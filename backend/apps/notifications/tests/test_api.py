"""
Tests for Notification API — Phase 10

Tests:
- Notification list endpoint
- Notification detail endpoint
- Mark as read endpoint
- Mark as unread endpoint
- Mark all as read endpoint
- Unread count endpoint
- Authorization and permissions
- Filtering and pagination
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from notifications.models import (
    Notification,
    NotificationPreference,
    NotificationSeverity,
    NotificationType,
)
from organizations.models import Membership, Organization


class NotificationAPITest(TestCase):
    """Test Notification API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
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

        # Create JWT token
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # Create test notifications
        self.notification1 = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_WARNING,
            title="Test Notification 1",
            message="Test message 1",
            severity=NotificationSeverity.WARNING,
        )
        self.notification2 = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type=NotificationType.SLA_BREACH,
            title="Test Notification 2",
            message="Test message 2",
            severity=NotificationSeverity.CRITICAL,
        )

    def test_list_notifications(self):
        """Test listing notifications."""
        response = self.client.get("/api/v1/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 2)

    def test_list_notifications_unread_only(self):
        """Test listing only unread notifications."""
        # Mark one as read
        self.notification1.mark_as_read()

        response = self.client.get("/api/v1/notifications/?unread_only=true")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], str(self.notification2.id))

    def test_list_notifications_filter_by_type(self):
        """Test filtering notifications by type."""
        response = self.client.get(
            f"/api/v1/notifications/?notification_type={NotificationType.SLA_WARNING}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["notification_type"], NotificationType.SLA_WARNING)

    def test_list_notifications_filter_by_severity(self):
        """Test filtering notifications by severity."""
        response = self.client.get(
            f"/api/v1/notifications/?severity={NotificationSeverity.CRITICAL}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["severity"], NotificationSeverity.CRITICAL)

    def test_retrieve_notification(self):
        """Test retrieving a specific notification."""
        response = self.client.get(f"/api/v1/notifications/{self.notification1.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.notification1.id))
        self.assertEqual(response.data["title"], "Test Notification 1")

    def test_retrieve_notification_unauthorized(self):
        """Test that users cannot access other users' notifications."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        Membership.objects.create(
            organization=self.organization,
            user=other_user,
            status="ACTIVE",
        )

        # Create notification for other user
        other_notification = Notification.objects.create(
            organization=self.organization,
            recipient=other_user,
            notification_type=NotificationType.SLA_WARNING,
            title="Other Notification",
            message="Other message",
        )

        # Try to access other user's notification
        response = self.client.get(f"/api/v1/notifications/{other_notification.id}/")
        self.assertEqual(response.status_code, 403)

    def test_mark_notification_read(self):
        """Test marking a notification as read."""
        self.assertFalse(self.notification1.is_read)

        response = self.client.patch(f"/api/v1/notifications/{self.notification1.id}/mark_read/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["notification"]["is_read"])

        # Refresh from database
        self.notification1.refresh_from_db()
        self.assertTrue(self.notification1.is_read)

    def test_mark_notification_unread(self):
        """Test marking a notification as unread."""
        self.notification1.mark_as_read()
        self.assertTrue(self.notification1.is_read)

        response = self.client.patch(f"/api/v1/notifications/{self.notification1.id}/mark_unread/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["notification"]["is_read"])

        # Refresh from database
        self.notification1.refresh_from_db()
        self.assertFalse(self.notification1.is_read)

    def test_mark_all_notifications_read(self):
        """Test marking all notifications as read."""
        self.assertFalse(self.notification1.is_read)
        self.assertFalse(self.notification2.is_read)

        response = self.client.post("/api/v1/notifications/mark_all_read/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        # Refresh from database
        self.notification1.refresh_from_db()
        self.notification2.refresh_from_db()
        self.assertTrue(self.notification1.is_read)
        self.assertTrue(self.notification2.is_read)

    def test_unread_count(self):
        """Test getting unread notification count."""
        self.notification1.mark_as_read()

        response = self.client.get("/api/v1/notifications/unread_count/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["unread_count"], 1)

    def test_update_notification_is_read(self):
        """Test updating notification is_read field."""
        self.assertFalse(self.notification1.is_read)

        response = self.client.patch(
            f"/api/v1/notifications/{self.notification1.id}/",
            {"is_read": True},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_read"])

    def test_update_notification_forbidden_fields(self):
        """Test that forbidden fields cannot be updated."""
        response = self.client.patch(
            f"/api/v1/notifications/{self.notification1.id}/",
            {"title": "Modified Title"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Only 'is_read' field can be updated", str(response.data))

    def test_delete_notification(self):
        """Test deleting a notification."""
        notification_id = self.notification1.id
        response = self.client.delete(f"/api/v1/notifications/{notification_id}/")
        self.assertEqual(response.status_code, 204)

        # Verify deletion
        self.assertFalse(Notification.objects.filter(id=notification_id).exists())

    def test_delete_notification_unauthorized(self):
        """Test that users cannot delete other users' notifications."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        Membership.objects.create(
            organization=self.organization,
            user=other_user,
            status="ACTIVE",
        )

        other_notification = Notification.objects.create(
            organization=self.organization,
            recipient=other_user,
            notification_type=NotificationType.SLA_WARNING,
            title="Other Notification",
            message="Other message",
        )

        response = self.client.delete(f"/api/v1/notifications/{other_notification.id}/")
        self.assertEqual(response.status_code, 403)

    def test_authentication_required(self):
        """Test that authentication is required."""
        # Remove authentication
        self.client.credentials()

        response = self.client.get("/api/v1/notifications/")
        self.assertEqual(response.status_code, 401)


class NotificationPreferenceAPITest(TestCase):
    """Test NotificationPreference API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
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

        # Create JWT token
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # Create test preference
        self.preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=self.user,
            email_enabled=True,
            in_app_enabled=True,
        )

    def test_list_preferences(self):
        """Test listing notification preferences."""
        response = self.client.get("/api/v1/notifications/preferences/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)

    def test_retrieve_preference(self):
        """Test retrieving a specific preference."""
        response = self.client.get(f"/api/v1/notifications/preferences/{self.preference.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.preference.id))

    def test_update_preference(self):
        """Test updating notification preferences."""
        response = self.client.patch(
            f"/api/v1/notifications/preferences/{self.preference.id}/",
            {"email_enabled": False},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["email_enabled"])

        # Refresh from database
        self.preference.refresh_from_db()
        self.assertFalse(self.preference.email_enabled)

    def test_update_preference_unauthorized(self):
        """Test that users cannot update other users' preferences."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        Membership.objects.create(
            organization=self.organization,
            user=other_user,
            status="ACTIVE",
        )

        other_preference = NotificationPreference.objects.create(
            organization=self.organization,
            user=other_user,
        )

        response = self.client.patch(
            f"/api/v1/notifications/preferences/{other_preference.id}/",
            {"email_enabled": False},
        )
        self.assertEqual(response.status_code, 403)
