"""
Serializers for real-time event payloads.

These serializers convert domain information into safe WebSocket payloads
without exposing sensitive internal data or entire model instances.
"""

from incidents.models import Incident
from rest_framework import serializers


class BaseEventSerializer(serializers.Serializer):
    """Base structure for all realtime events."""

    event = serializers.CharField()
    version = serializers.CharField()
    organization_id = serializers.UUIDField()
    timestamp = serializers.DateTimeField()


class IncidentEventSerializer(BaseEventSerializer):
    """Serializer for incident-related events."""

    data = serializers.DictField()

    @staticmethod
    def serialize_incident(incident: Incident) -> dict:
        """
        Extract safe incident data for realtime events.

        Only includes fields needed by the Operations Dashboard.
        Excludes sensitive information and internal fields.
        """
        return {
            "id": str(incident.id),
            "incident_number": incident.incident_number,
            "title": incident.title,
            "status": incident.status,
            "priority": incident.priority,
            "assignee_id": str(incident.assignee.id) if incident.assignee else None,
            "category_id": str(incident.category.id) if incident.category else None,
            "created_at": incident.created_at.isoformat(),
            "updated_at": incident.updated_at.isoformat(),
        }


class SLAEventSerializer(BaseEventSerializer):
    """Serializer for SLA-related events."""

    data = serializers.DictField()

    @staticmethod
    def serialize_sla_event(
        incident_id: str,
        incident_number: str,
        sla_type: str,  # "response" or "resolution"
        state: str,  # "warning" or "breached"
        deadline: str,
        organization_id: str,
    ) -> dict:
        """
        Extract safe SLA event data.

        Includes only the information needed for dashboard SLA monitoring.
        """
        return {
            "incident_id": incident_id,
            "incident_number": incident_number,
            "sla_type": sla_type,
            "state": state,
            "deadline": deadline,
            "organization_id": organization_id,
        }


class EscalationEventSerializer(BaseEventSerializer):
    """Serializer for escalation-related events."""

    data = serializers.DictField()

    @staticmethod
    def serialize_escalation_event(
        escalation_id: str,
        incident_id: str,
        incident_number: str,
        escalation_level: int,
        status: str,
        organization_id: str,
    ) -> dict:
        """
        Extract safe escalation event data.

        Includes only the information needed for dashboard escalation monitoring.
        """
        return {
            "escalation_id": escalation_id,
            "incident_id": incident_id,
            "incident_number": incident_number,
            "escalation_level": escalation_level,
            "status": status,
            "organization_id": organization_id,
        }


class NotificationEventSerializer(BaseEventSerializer):
    """Serializer for notification-related events."""

    data = serializers.DictField()

    @staticmethod
    def serialize_notification_event(
        notification_id: str,
        notification_type: str,
        incident_id: str | None,
        incident_number: str | None,
        organization_id: str,
    ) -> dict:
        """
        Extract safe notification event data.

        Includes only the information needed for dashboard notification monitoring.
        """
        return {
            "notification_id": notification_id,
            "notification_type": notification_type,
            "incident_id": incident_id,
            "incident_number": incident_number,
            "organization_id": organization_id,
        }


class CommentEventSerializer(BaseEventSerializer):
    """Serializer for comment-related events."""

    data = serializers.DictField()

    @staticmethod
    def serialize_comment(comment) -> dict:
        """
        Extract safe comment data for realtime events.

        Only includes fields needed by the Operations Dashboard.
        Excludes sensitive information and internal fields.
        """
        return {
            "id": str(comment.id),
            "incident_id": str(comment.incident_id),
            "incident_number": comment.incident.incident_number,
            "author_id": str(comment.author_id),
            "author_email": comment.author.email,
            "body": comment.body,
            "is_internal": comment.is_internal,
            "mentioned_user_ids": [
                str(user.id) for user in comment.mentioned_users.all()
            ],
            "created_at": comment.created_at.isoformat(),
            "updated_at": comment.updated_at.isoformat(),
        }
