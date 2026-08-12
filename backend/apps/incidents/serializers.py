from typing import ClassVar

from incidents.models import (
    Incident,
    IncidentCategory,
    IncidentPriority,
    IncidentStatus,
)
from rest_framework import serializers


class IncidentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentCategory
        fields: ClassVar = [
            "id",
            "name",
            "slug",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields


class IncidentCategoryMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentCategory
        fields: ClassVar = ["id", "name"]
        read_only_fields: ClassVar = fields


class IncidentCategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default=""
    )

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Category name is required.")
        return value.strip()


class IncidentCategoryUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    description = serializers.CharField(
        max_length=1000, required=False, allow_blank=True
    )
    is_active = serializers.BooleanField(required=False)


class IncidentReporterSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="reporter.id")
    email = serializers.EmailField(source="reporter.email")


class IncidentAssigneeUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()


class IncidentAssigneeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user = IncidentAssigneeUserSerializer()


class IncidentSerializer(serializers.ModelSerializer):
    """
    Full incident representation including embedded SLA summary.

    The `sla` field is None when no SLA policy was configured at incident
    creation time (graceful degradation).
    """

    category = IncidentCategoryMinimalSerializer(read_only=True)
    reporter = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()
    sla = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields: ClassVar = [
            "id",
            "incident_number",
            "title",
            "description",
            "status",
            "priority",
            "category",
            "reporter",
            "assignee",
            "sla",
            "created_at",
            "updated_at",
            "resolved_at",
        ]
        read_only_fields: ClassVar = fields

    def get_reporter(self, obj) -> dict | None:
        if not obj.reporter:
            return None
        return {
            "id": str(obj.reporter.id),
            "email": obj.reporter.email,
        }

    def get_assignee(self, obj) -> dict | None:
        if not obj.assignee:
            return None
        return {
            "id": str(obj.assignee.id),
            "user": {
                "id": str(obj.assignee.user.id),
                "email": obj.assignee.user.email,
            },
        }

    def get_sla(self, obj) -> dict | None:
        """
        Return embedded SLA summary or None if no SLA record exists.
        Uses hasattr / try-except to safely handle missing reverse relation.
        """
        try:
            sla = obj.sla
        except Exception:  # noqa: BLE001
            return None
        if sla is None:
            return None

        # Import here to avoid circular import at module level
        from sla.serializers import IncidentSLASummarySerializer

        return IncidentSLASummarySerializer(sla).data


class IncidentCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, trim_whitespace=True)
    description = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default=""
    )
    priority = serializers.ChoiceField(
        choices=IncidentPriority.choices, default=IncidentPriority.P3
    )
    category_id = serializers.UUIDField(required=False, allow_null=True)
    assignee_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Incident title is required.")
        return value.strip()


class IncidentUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    description = serializers.CharField(
        max_length=5000, required=False, allow_blank=True
    )
    priority = serializers.ChoiceField(choices=IncidentPriority.choices, required=False)
    category_id = serializers.UUIDField(required=False, allow_null=True)
    assignee_id = serializers.UUIDField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=IncidentStatus.choices, required=False)
