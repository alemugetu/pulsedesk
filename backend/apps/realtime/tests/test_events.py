"""
Tests for realtime event types and structure.
"""

from django.test import TestCase
from realtime.events import RealtimeEventType


class TestRealtimeEventType(TestCase):
    """Test realtime event type enumeration."""

    def test_all_event_types_defined(self):
        """Verify all expected event types are defined."""
        expected_types = {
            "incident.created",
            "incident.updated",
            "incident.status_changed",
            "incident.assigned",
            "sla.warning",
            "sla.breached",
            "escalation.triggered",
            "escalation.completed",
            "notification.created",
        }
        actual_types = set(RealtimeEventType.all_values())
        self.assertEqual(expected_types, actual_types)

    def test_event_type_validation(self):
        """Test event type validation logic."""
        self.assertTrue(RealtimeEventType.is_valid("incident.created"))
        self.assertTrue(RealtimeEventType.is_valid("sla.breached"))
        self.assertFalse(RealtimeEventType.is_valid("invalid.event"))
        self.assertFalse(RealtimeEventType.is_valid(""))
