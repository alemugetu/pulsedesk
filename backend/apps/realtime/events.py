"""
Real-time event type definitions for PulseDesk operations.

Events are published only from meaningful business operations, not from
arbitrary model saves. This ensures the WebSocket layer receives
high-value operational updates without noise.
"""

from enum import Enum


class RealtimeEventType(str, Enum):
    """Controlled set of real-time event types for operations dashboard."""

    # Incident events
    INCIDENT_CREATED = "incident.created"
    INCIDENT_UPDATED = "incident.updated"
    INCIDENT_STATUS_CHANGED = "incident.status_changed"
    INCIDENT_ASSIGNED = "incident.assigned"

    # SLA events
    SLA_WARNING = "sla.warning"
    SLA_BREACHED = "sla.breached"

    # Escalation events
    ESCALATION_TRIGGERED = "escalation.triggered"
    ESCALATION_COMPLETED = "escalation.completed"

    # Notification events
    NOTIFICATION_CREATED = "notification.created"

    @classmethod
    def all_values(cls) -> list[str]:
        """Return all event type values as strings."""
        return [event.value for event in cls]

    @classmethod
    def is_valid(cls, event_type: str) -> bool:
        """Check if an event type string is valid."""
        return event_type in cls.all_values()


# Event version for future compatibility
EVENT_VERSION = "1.0"

# Channel group naming convention
# Format: operations_org_{organization_uuid}
CHANNEL_GROUP_PREFIX = "operations_org"
