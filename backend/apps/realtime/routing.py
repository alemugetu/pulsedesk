"""
URL routing for WebSocket connections.

Defines the WebSocket URL patterns for the operations dashboard.
"""

from django.urls import re_path
from realtime.consumers import OperationsConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/v1/organizations/(?P<organization_id>[^/]+)/operations/$",
        OperationsConsumer.as_asgi(),
    ),
]
