"""
Tests for WebSocket consumers.
"""

from django.test import TestCase
from realtime.routing import websocket_urlpatterns


class TestOperationsConsumer(TestCase):
    """Test operations WebSocket consumer."""

    def test_websocket_url_routing(self):
        """Test that WebSocket URL is properly routed."""
        # Verify the URL pattern exists
        self.assertEqual(len(websocket_urlpatterns), 1)
        pattern = websocket_urlpatterns[0]
        # The pattern should contain organizations in the regex
        self.assertIn("organizations", str(pattern.pattern))

    def test_consumer_has_realtime_event_handler(self):
        """Test that consumer has realtime_event handler."""
        from realtime.consumers import OperationsConsumer

        # Verify the handler method exists
        self.assertTrue(hasattr(OperationsConsumer, "realtime_event"))

    def test_consumer_has_required_methods(self):
        """Test that consumer has required WebSocket methods."""
        from realtime.consumers import OperationsConsumer

        # Verify required WebSocket consumer methods exist
        self.assertTrue(hasattr(OperationsConsumer, "connect"))
        self.assertTrue(hasattr(OperationsConsumer, "disconnect"))
        self.assertTrue(hasattr(OperationsConsumer, "receive"))
