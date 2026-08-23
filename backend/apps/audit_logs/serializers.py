"""
Serializers for the AuditLog module.

AuditLog records are read-only — no create/update serializer is provided.
The API only exposes safe metadata; internal IDs and implementation details
are not surfaced.
"""

from typing import ClassVar

from audit_logs.models import AuditLog
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class AuditLogActorSerializer(serializers.Serializer):
    """Safe summary of the actor (user) who performed the action."""

    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField(allow_blank=True, required=False)
    last_name = serializers.CharField(allow_blank=True, required=False)


class AuditLogSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for AuditLog records.

    Intentionally exposes only safe metadata:
    - No internal DB paths or credentials.
    - actor is a safe summary dict (null for system events).
    - changes is the sanitized JSON metadata provided at log time.
    """

    actor = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields: ClassVar = [
            "id",
            "organization",
            "actor",
            "action",
            "resource_type",
            "resource_id",
            "changes",
            "ip_address",
            "created_at",
        ]
        read_only_fields: ClassVar = [
            "id",
            "organization",
            "actor",
            "action",
            "resource_type",
            "resource_id",
            "changes",
            "ip_address",
            "created_at",
        ]

    @extend_schema_field(AuditLogActorSerializer)
    def get_actor(self, obj):
        """Return a safe actor summary, or null for system-generated events."""
        if obj.actor is None:
            return None
        return {
            "id": str(obj.actor.id),
            "email": obj.actor.email,
            "first_name": obj.actor.first_name,
            "last_name": obj.actor.last_name,
        }
