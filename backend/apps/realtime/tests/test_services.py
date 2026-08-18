"""
Tests for realtime event publishing service.
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone
from incidents.models import Incident, IncidentPriority, IncidentStatus
from organizations.models import Membership, Organization
from realtime.events import CHANNEL_GROUP_PREFIX, EVENT_VERSION
from realtime.serializers import IncidentEventSerializer
from realtime.services import RealtimeEventService


class TestRealtimeEventService(TestCase):
    """Test realtime event publishing service."""

    def setUp(self):
        """Set up test data."""
        self.organization = Organization.objects.create(
            name="Test Organization",
            slug="test-org",
            status="ACTIVE",
        )
        self.user = self._create_user()
        self.membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
            role=self._create_role(self.organization),
            status="ACTIVE",
        )
        self.incident = Incident.objects.create(
            organization=self.organization,
            incident_number="INC-000001",
            title="Test Incident",
            description="Test description",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
        )

    def _create_user(self):
        """Create a test user."""
        from accounts.models import User

        user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        user.email_verified_at = timezone.now()
        user.save()
        return user

    def _create_role(self, organization):
        """Create a test role."""
        from organizations.models import Role

        return Role.objects.create(
            organization=organization,
            name="Test Role",
            slug="test-role",
        )

    @patch("realtime.services.asgiref.sync.async_to_sync")
    @patch("realtime.services.get_channel_layer")
    @patch("realtime.services.transaction.on_commit")
    def test_publish_incident_created(
        self, mock_on_commit, mock_get_channel_layer, mock_async_to_sync
    ):
        """Test publishing incident.created event."""
        # Mock the channel layer
        mock_channel_layer = MagicMock()
        mock_get_channel_layer.return_value = mock_channel_layer

        # Mock the async_to_sync wrapper
        mock_async_to_sync.return_value = MagicMock()

        # Call the service method
        RealtimeEventService.publish_incident_created(self.incident)

        # Verify transaction.on_commit was called (defers publishing)
        mock_on_commit.assert_called_once()

    def test_construct_event_envelope(self):
        """Test event envelope construction."""
        data = {"test": "data"}
        envelope = RealtimeEventService._construct_event_envelope(
            "test.event", str(self.organization.id), data
        )

        self.assertEqual(envelope["event"], "test.event")
        self.assertEqual(envelope["version"], EVENT_VERSION)
        self.assertEqual(envelope["organization_id"], str(self.organization.id))
        self.assertIn("timestamp", envelope)
        self.assertEqual(envelope["data"], data)

    def test_get_channel_group_name(self):
        """Test channel group name generation."""
        group_name = RealtimeEventService._get_channel_group_name(
            str(self.organization.id)
        )
        expected = f"{CHANNEL_GROUP_PREFIX}_{self.organization.id}"
        self.assertEqual(group_name, expected)


class TestIncidentEventSerializer(TestCase):
    """Test incident event serialization."""

    def setUp(self):
        """Set up test data."""
        self.organization = Organization.objects.create(
            name="Test Organization",
            slug="test-org",
            status="ACTIVE",
        )
        self.user = self._create_user()
        self.membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
            role=self._create_role(self.organization),
            status="ACTIVE",
        )
        self.incident = Incident.objects.create(
            organization=self.organization,
            incident_number="INC-000001",
            title="Test Incident",
            description="Test description",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

    def _create_user(self):
        """Create a test user."""
        from accounts.models import User

        user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        user.email_verified_at = timezone.now()
        user.save()
        return user

    def _create_role(self, organization):
        """Create a test role."""
        from organizations.models import Role

        return Role.objects.create(
            organization=organization,
            name="Test Role",
            slug="test-role",
        )

    def test_serialize_incident(self):
        """Test incident serialization."""
        data = IncidentEventSerializer.serialize_incident(self.incident)

        # Verify safe fields are included
        self.assertEqual(data["id"], str(self.incident.id))
        self.assertEqual(data["incident_number"], self.incident.incident_number)
        self.assertEqual(data["title"], self.incident.title)
        self.assertEqual(data["status"], self.incident.status)
        self.assertEqual(data["priority"], self.incident.priority)
        self.assertEqual(data["assignee_id"], str(self.membership.id))
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)

        # Verify sensitive fields are excluded
        self.assertNotIn("description", data)
        self.assertNotIn("reporter", data)
