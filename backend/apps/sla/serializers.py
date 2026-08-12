"""
SLA Serializers — Phase 6

Input/output serializers for SLA policies, targets, and incident SLA summaries.
Business logic must not live here — it belongs in services.py.
"""

from typing import ClassVar

from incidents.models import IncidentPriority
from rest_framework import serializers
from sla.models import IncidentSLA, SLAPolicy, SLATarget

# ---------------------------------------------------------------------------
# SLA Target serializers
# ---------------------------------------------------------------------------


class SLATargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLATarget
        fields: ClassVar = [
            "id",
            "priority",
            "response_time_minutes",
            "resolution_time_minutes",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields


class SLATargetCreateSerializer(serializers.Serializer):
    priority = serializers.ChoiceField(choices=IncidentPriority.choices)
    response_time_minutes = serializers.IntegerField(min_value=1)
    resolution_time_minutes = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        if attrs["resolution_time_minutes"] < attrs["response_time_minutes"]:
            raise serializers.ValidationError(
                {
                    "resolution_time_minutes": (
                        "Resolution time must be greater than or equal to response time."
                    )
                }
            )
        return attrs


class SLATargetUpdateSerializer(serializers.Serializer):
    response_time_minutes = serializers.IntegerField(min_value=1, required=False)
    resolution_time_minutes = serializers.IntegerField(min_value=1, required=False)


# ---------------------------------------------------------------------------
# SLA Policy serializers
# ---------------------------------------------------------------------------


class SLAPolicySerializer(serializers.ModelSerializer):
    targets = SLATargetSerializer(many=True, read_only=True)

    class Meta:
        model = SLAPolicy
        fields: ClassVar = [
            "id",
            "name",
            "description",
            "is_active",
            "is_default",
            "targets",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields


class SLAPolicyCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    description = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, default=""
    )
    is_active = serializers.BooleanField(default=True)
    is_default = serializers.BooleanField(default=False)

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("SLA policy name is required.")
        return value.strip()


class SLAPolicyUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    description = serializers.CharField(
        max_length=2000, required=False, allow_blank=True
    )
    is_active = serializers.BooleanField(required=False)
    is_default = serializers.BooleanField(required=False)


# ---------------------------------------------------------------------------
# Incident SLA summary serializer (nested in IncidentSerializer)
# ---------------------------------------------------------------------------


class IncidentSLASummarySerializer(serializers.Serializer):
    """
    Read-only SLA summary embedded in incident API responses.

    Computes response_status and resolution_status dynamically at serialization
    time using the evaluation logic from SLACalculationService.
    """

    policy = serializers.SerializerMethodField()
    response_deadline = serializers.DateTimeField(read_only=True)
    resolution_deadline = serializers.DateTimeField(read_only=True)
    response_status = serializers.SerializerMethodField()
    resolution_status = serializers.SerializerMethodField()
    response_completed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    resolution_completed_at = serializers.DateTimeField(read_only=True, allow_null=True)

    def get_policy(self, obj: IncidentSLA) -> str:
        return obj.policy.name if obj.policy_id else ""

    def get_response_status(self, obj: IncidentSLA) -> str:
        from sla.services import SLACalculationService

        return SLACalculationService.get_response_sla_status(obj)

    def get_resolution_status(self, obj: IncidentSLA) -> str:
        from sla.services import SLACalculationService

        return SLACalculationService.get_resolution_sla_status(obj)
