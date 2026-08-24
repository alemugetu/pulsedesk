from typing import ClassVar

from incidents.models import IncidentPriority, IncidentStatus
from rest_framework import serializers
from settings.models import OrganizationSettings


class OrganizationSettingsReadSerializer(serializers.ModelSerializer):
    """Read-only serializer for organization settings."""

    class Meta:
        model = OrganizationSettings
        fields = (
            "id",
            "default_incident_priority",
            "default_incident_status",
            "incident_comments_enabled",
            "notification_incident_emails_enabled",
            "notification_escalation_emails_enabled",
            "notification_sla_emails_enabled",
            "sla_auto_apply_default_policy",
            "escalation_auto_apply_default_policy",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class OrganizationSettingsUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for partial PATCH updates to organization settings."""

    default_incident_priority = serializers.ChoiceField(
        choices=IncidentPriority.choices,
        required=False,
    )
    default_incident_status = serializers.ChoiceField(
        choices=IncidentStatus.choices,
        required=False,
    )

    class Meta:
        model = OrganizationSettings
        fields = (
            "default_incident_priority",
            "default_incident_status",
            "incident_comments_enabled",
            "notification_incident_emails_enabled",
            "notification_escalation_emails_enabled",
            "notification_sla_emails_enabled",
            "sla_auto_apply_default_policy",
            "escalation_auto_apply_default_policy",
        )

    # Fields that are silently ignored when supplied by the client (they can
    # never be written through this serializer; the FK is immutable).  This
    # avoids 400s when defensive or malicious clients include the org FK.
    SILENTLY_IGNORED_KEYS: ClassVar = {"organization", "organization_id"}

    def validate(self, attrs):
        """
        Strict validation: reject unknown fields and coerce only the
        documented set of configurable keys.
        """
        allowed = set(self.Meta.fields) | self.SILENTLY_IGNORED_KEYS
        writable = set(self.Meta.fields)
        # self.initial_data contains the raw user-supplied payload (before
        # serializer filtering).  Use it to detect keys that were not
        # declared on the serializer.
        unknown = set(self.initial_data.keys()) - allowed
        if unknown:
            raise serializers.ValidationError(
                detail=(
                    "Unknown setting field(s): "
                    f"{sorted(unknown)}. Allowed fields: "
                    f"{sorted(writable)}."
                ),
                code="unknown_fields",
            )
        return attrs
