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

    def test_websocket_pattern_matches_real_path(self):
        """Channels URLRouter matches the scope path without a leading slash."""
        pattern = str(websocket_urlpatterns[0].pattern)
        # Channels passes the websocket path to the URLRouter WITHOUT the
        # leading slash (scope path 'ws/v1/...'), so the pattern must anchor
        # at '^ws/...' — a route anchored at '^/ws/...' never matches and
        # returns 500 "No route found".
        self.assertTrue(
            pattern.startswith("^ws/v1/organizations/"),
            f"pattern must start with '^ws/v1/organizations/', got: {pattern}",
        )

    def test_websocket_pattern_resolves_operations_path(self):
        """The real path resolved by the resolver (no 500) yields the org id."""
        pattern = websocket_urlpatterns[0].pattern
        matched = pattern.match(
            "ws/v1/organizations/00000000-0000-0000-0000-000000000000/operations/"
        )
        self.assertIsNotNone(matched)
        _, _, kwargs = matched
        self.assertEqual(
            kwargs["organization_id"],
            "00000000-0000-0000-0000-000000000000",
        )
        # A non-operations path must not resolve to this route.
        self.assertIsNone(
            pattern.match("ws/v1/organizations/00000000-0000-0000-0000-000000000000/other/")
        )

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
