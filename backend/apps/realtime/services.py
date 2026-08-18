"""
Service layer for real-time event publishing.

This service handles publishing events to the appropriate channel groups
after successful business operations. It ensures transaction safety by
using transaction.on_commit() and validates organization context.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import asgiref.sync
from channels.layers import get_channel_layer
from django.db import transaction
from realtime.events import CHANNEL_GROUP_PREFIX, EVENT_VERSION, RealtimeEventType
from realtime.serializers import (
    EscalationEventSerializer,
    IncidentEventSerializer,
    NotificationEventSerializer,
    SLAEventSerializer,
)

logger = logging.getLogger(__name__)


class RealtimeEventService:
    """
    Service for publishing real-time events to WebSocket clients.

    Events are published only after successful database transactions
    to ensure frontend never receives notifications for rolled-back changes.
    """

    @staticmethod
    def _get_channel_group_name(organization_id: str) -> str:
        """
        Generate the channel group name for an organization.

        Format: operations_org_{organization_uuid}
        """
        return f"{CHANNEL_GROUP_PREFIX}_{organization_id}"

    @staticmethod
    def _construct_event_envelope(
        event_type: str, organization_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Construct the standardized event envelope.

        The envelope includes versioning for future compatibility.
        """
        return {
            "event": event_type,
            "version": EVENT_VERSION,
            "organization_id": str(organization_id),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "data": data,
        }

    @staticmethod
    async def _publish_event_async(
        group_name: str, event_envelope: dict[str, Any]
    ) -> None:
        """
        Async method to publish event to channel group.

        This is called by the sync wrapper via asgiref.sync.
        """
        channel_layer = get_channel_layer()
        try:
            await channel_layer.group_send(
                group_name,
                {
                    "type": "realtime.event",
                    "data": event_envelope,
                },
            )
            logger.info(
                "Realtime event published successfully",
                extra={
                    "event_type": event_envelope["event"],
                    "organization_id": event_envelope["organization_id"],
                    "group": group_name,
                },
            )
        except Exception as e:
            # Log but don't raise - realtime delivery failure should not
            # cause business operations to fail
            logger.exception(
                "Failed to publish realtime event",
                extra={
                    "event_type": event_envelope["event"],
                    "organization_id": event_envelope["organization_id"],
                    "error": str(e),
                },
            )

    @staticmethod
    def _publish_event_sync(group_name: str, event_envelope: dict[str, Any]) -> None:
        """
        Sync wrapper for async event publishing.

        Uses asgiref.sync to bridge sync Django code with async Channels.
        """
        asgiref.sync.async_to_sync(RealtimeEventService._publish_event_async)(
            group_name, event_envelope
        )

    @staticmethod
    def publish_incident_created(incident) -> None:
        """
        Publish incident.created event.

        Called after successful incident creation transaction.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.INCIDENT_CREATED.value):
            return

        incident_data = IncidentEventSerializer.serialize_incident(incident)
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.INCIDENT_CREATED.value,
            str(incident.organization_id),
            incident_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(
            str(incident.organization_id)
        )

        # Publish only after transaction commits
        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_incident_updated(incident) -> None:
        """
        Publish incident.updated event.

        Called after successful incident update transaction.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.INCIDENT_UPDATED.value):
            return

        incident_data = IncidentEventSerializer.serialize_incident(incident)
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.INCIDENT_UPDATED.value,
            str(incident.organization_id),
            incident_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(
            str(incident.organization_id)
        )

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_incident_status_changed(
        incident, old_status: str, new_status: str
    ) -> None:
        """
        Publish incident.status_changed event.

        Called after successful incident status transition.
        """
        if not RealtimeEventType.is_valid(
            RealtimeEventType.INCIDENT_STATUS_CHANGED.value
        ):
            return

        incident_data = IncidentEventSerializer.serialize_incident(incident)
        incident_data["old_status"] = old_status
        incident_data["new_status"] = new_status

        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.INCIDENT_STATUS_CHANGED.value,
            str(incident.organization_id),
            incident_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(
            str(incident.organization_id)
        )

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_incident_assigned(incident, assignee_id: str | None) -> None:
        """
        Publish incident.assigned event.

        Called after successful incident assignment.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.INCIDENT_ASSIGNED.value):
            return

        incident_data = IncidentEventSerializer.serialize_incident(incident)
        incident_data["assignee_id"] = assignee_id

        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.INCIDENT_ASSIGNED.value,
            str(incident.organization_id),
            incident_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(
            str(incident.organization_id)
        )

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_sla_warning(
        incident_id: str,
        incident_number: str,
        sla_type: str,
        deadline: str,
        organization_id: str,
    ) -> None:
        """
        Publish sla.warning event.

        Called when SLA approaches deadline.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.SLA_WARNING.value):
            return

        sla_data = SLAEventSerializer.serialize_sla_event(
            incident_id,
            incident_number,
            sla_type,
            "warning",
            deadline,
            str(organization_id),
        )
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.SLA_WARNING.value,
            str(organization_id),
            sla_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(str(organization_id))

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_sla_breached(
        incident_id: str,
        incident_number: str,
        sla_type: str,
        deadline: str,
        organization_id: str,
    ) -> None:
        """
        Publish sla.breached event.

        Called when SLA deadline is exceeded.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.SLA_BREACHED.value):
            return

        sla_data = SLAEventSerializer.serialize_sla_event(
            incident_id,
            incident_number,
            sla_type,
            "breached",
            deadline,
            str(organization_id),
        )
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.SLA_BREACHED.value,
            str(organization_id),
            sla_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(str(organization_id))

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_escalation_triggered(
        escalation_id: str,
        incident_id: str,
        incident_number: str,
        escalation_level: int,
        organization_id: str,
    ) -> None:
        """
        Publish escalation.triggered event.

        Called when an escalation is triggered.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.ESCALATION_TRIGGERED.value):
            return

        escalation_data = EscalationEventSerializer.serialize_escalation_event(
            escalation_id,
            incident_id,
            incident_number,
            escalation_level,
            "triggered",
            str(organization_id),
        )
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.ESCALATION_TRIGGERED.value,
            str(organization_id),
            escalation_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(str(organization_id))

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_escalation_completed(
        escalation_id: str,
        incident_id: str,
        incident_number: str,
        escalation_level: int,
        organization_id: str,
    ) -> None:
        """
        Publish escalation.completed event.

        Called when an escalation is completed.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.ESCALATION_COMPLETED.value):
            return

        escalation_data = EscalationEventSerializer.serialize_escalation_event(
            escalation_id,
            incident_id,
            incident_number,
            escalation_level,
            "completed",
            str(organization_id),
        )
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.ESCALATION_COMPLETED.value,
            str(organization_id),
            escalation_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(str(organization_id))

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )

    @staticmethod
    def publish_notification_created(
        notification_id: str,
        notification_type: str,
        incident_id: str | None,
        incident_number: str | None,
        organization_id: str,
    ) -> None:
        """
        Publish notification.created event.

        Called when an important notification is created.
        """
        if not RealtimeEventType.is_valid(RealtimeEventType.NOTIFICATION_CREATED.value):
            return

        notification_data = NotificationEventSerializer.serialize_notification_event(
            notification_id,
            notification_type,
            incident_id,
            incident_number,
            str(organization_id),
        )
        event_envelope = RealtimeEventService._construct_event_envelope(
            RealtimeEventType.NOTIFICATION_CREATED.value,
            str(organization_id),
            notification_data,
        )
        group_name = RealtimeEventService._get_channel_group_name(str(organization_id))

        transaction.on_commit(
            lambda: RealtimeEventService._publish_event_sync(group_name, event_envelope)
        )
