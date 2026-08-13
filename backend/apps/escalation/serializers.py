"""
Escalation Serializers — Phase 7

Input/output serializers for escalation policies, levels, rules,
and incident escalation history. Business logic lives in services.py.
"""

from typing import ClassVar

from escalation.models import (
    EscalationEvent,
    EscalationLevel,
    EscalationPolicy,
    EscalationRule,
    EscalationTargetType,
    EscalationTriggerType,
    IncidentEscalation,
)
from rest_framework import serializers

# ---------------------------------------------------------------------------
# EscalationLevel serializers
# ---------------------------------------------------------------------------


class EscalationLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = EscalationLevel
        fields: ClassVar = [
            "id",
            "level",
            "name",
            "delay_minutes",
            "target_type",
            "target_reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields


class EscalationLevelCreateSerializer(serializers.Serializer):
    level = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    delay_minutes = serializers.IntegerField(min_value=0, default=0)
    target_type = serializers.ChoiceField(choices=EscalationTargetType.choices)
    target_reference = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
        help_text="Role UUID for ROLE target type; leave empty for ASSIGNEE.",
    )

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Level name is required.")
        return value.strip()


class EscalationLevelUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    delay_minutes = serializers.IntegerField(min_value=0, required=False)
    target_type = serializers.ChoiceField(
        choices=EscalationTargetType.choices, required=False
    )
    target_reference = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Role UUID for ROLE target type; leave empty for ASSIGNEE.",
    )


# ---------------------------------------------------------------------------
# EscalationRule serializers
# ---------------------------------------------------------------------------


class EscalationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EscalationRule
        fields: ClassVar = [
            "id",
            "trigger_type",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields


class EscalationRuleCreateSerializer(serializers.Serializer):
    trigger_type = serializers.ChoiceField(choices=EscalationTriggerType.choices)
    is_active = serializers.BooleanField(default=True)


# ---------------------------------------------------------------------------
# EscalationPolicy serializers
# ---------------------------------------------------------------------------


class EscalationPolicySerializer(serializers.ModelSerializer):
    levels = EscalationLevelSerializer(many=True, read_only=True)
    rules = EscalationRuleSerializer(many=True, read_only=True)

    class Meta:
        model = EscalationPolicy
        fields: ClassVar = [
            "id",
            "name",
            "description",
            "is_active",
            "is_default",
            "levels",
            "rules",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields


class EscalationPolicyCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    description = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, default=""
    )
    is_active = serializers.BooleanField(default=True)
    is_default = serializers.BooleanField(default=False)

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Escalation policy name is required.")
        return value.strip()


class EscalationPolicyUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    description = serializers.CharField(
        max_length=2000, required=False, allow_blank=True
    )
    is_active = serializers.BooleanField(required=False)
    is_default = serializers.BooleanField(required=False)


# ---------------------------------------------------------------------------
# EscalationEvent serializer (read-only history)
# ---------------------------------------------------------------------------


class EscalationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = EscalationEvent
        fields: ClassVar = [
            "id",
            "level",
            "trigger_type",
            "triggered_at",
            "target_type",
            "target_reference",
            "status",
        ]
        read_only_fields: ClassVar = fields


# ---------------------------------------------------------------------------
# IncidentEscalation serializer (nested events)
# ---------------------------------------------------------------------------


class IncidentEscalationSerializer(serializers.ModelSerializer):
    policy = serializers.SerializerMethodField()
    events = EscalationEventSerializer(many=True, read_only=True)

    class Meta:
        model = IncidentEscalation
        fields: ClassVar = [
            "id",
            "policy",
            "trigger_type",
            "current_level",
            "status",
            "started_at",
            "last_evaluated_at",
            "completed_at",
            "events",
        ]
        read_only_fields: ClassVar = fields

    def get_policy(self, obj: IncidentEscalation) -> str:
        return obj.policy.name if obj.policy_id else ""


# ---------------------------------------------------------------------------
# Evaluate endpoint serializers
# ---------------------------------------------------------------------------


class EscalationEvaluateSerializer(serializers.Serializer):
    """Input serializer for the manual evaluate endpoint."""

    trigger_type = serializers.ChoiceField(choices=EscalationTriggerType.choices)
