from typing import ClassVar

from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    Permission,
    Role,
)
from organizations.services import OrganizationService, RBACService
from rest_framework import serializers

# ---------------------------------------------------------------------------
# Organization serializers
# ---------------------------------------------------------------------------


class OrganizationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Organization name is required.")
        return value.strip()

    def validate_slug(self, value):
        if value:
            normalized = Organization.normalize_slug(value)
            if not normalized:
                raise serializers.ValidationError("Enter a valid slug.")
            return normalized
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        slug = validated_data.get("slug") or None
        return OrganizationService.create_organization(
            user=user,
            name=validated_data["name"],
            slug=slug,
        )


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields: ClassVar = ["id", "name", "slug", "status", "created_at", "updated_at"]
        read_only_fields: ClassVar = fields


# ---------------------------------------------------------------------------
# Permission serializer
# ---------------------------------------------------------------------------


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields: ClassVar = [
            "id",
            "codename",
            "name",
            "resource",
            "action",
            "description",
        ]
        read_only_fields: ClassVar = fields


# ---------------------------------------------------------------------------
# Role serializers
# ---------------------------------------------------------------------------


class RoleSerializer(serializers.ModelSerializer):
    """Read serializer for roles — exposes permission codenames."""

    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields: ClassVar = [
            "id",
            "name",
            "slug",
            "description",
            "is_system_role",
            "permissions",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = fields

    def get_permissions(self, obj) -> list[str]:
        return list(obj.permissions.values_list("codename", flat=True))


class RoleCreateSerializer(serializers.Serializer):
    """Write serializer for creating a custom role."""

    name = serializers.CharField(max_length=255, trim_whitespace=True)
    description = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default=""
    )
    permissions = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        help_text="List of permission codenames to attach to this role.",
    )

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Role name is required.")
        return value.strip()

    def create(self, validated_data):
        organization = self.context["organization"]
        actor_membership = self.context["actor_membership"]
        return RBACService.create_role(
            organization=organization,
            name=validated_data["name"],
            description=validated_data.get("description", ""),
            permission_codenames=validated_data.get("permissions") or [],
            actor_membership=actor_membership,
        )


class RoleUpdateSerializer(serializers.Serializer):
    """Write serializer for updating a custom role."""

    name = serializers.CharField(max_length=255, trim_whitespace=True, required=False)
    description = serializers.CharField(
        max_length=1000, required=False, allow_blank=True
    )
    permissions = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="Full replacement list of permission codenames. Omit to leave unchanged.",
    )

    def validate_name(self, value):
        if value is not None and not value.strip():
            raise serializers.ValidationError("Role name cannot be empty.")
        return value.strip() if value else value

    def update(self, instance, validated_data):
        actor_membership = self.context["actor_membership"]
        return RBACService.update_role(
            role=instance,
            actor_membership=actor_membership,
            name=validated_data.get("name"),
            description=validated_data.get("description"),
            permission_codenames=validated_data.get("permissions"),
        )


# ---------------------------------------------------------------------------
# Membership serializers
# ---------------------------------------------------------------------------


class MembershipUserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class MembershipSerializer(serializers.ModelSerializer):
    user = MembershipUserSerializer(read_only=True)
    role = RoleSerializer(read_only=True)

    class Meta:
        model = Membership
        fields: ClassVar = ["id", "user", "role", "status", "created_at", "updated_at"]
        read_only_fields: ClassVar = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["user"] = {
            "id": instance.user.id,
            "email": instance.user.email,
            "first_name": instance.user.first_name,
            "last_name": instance.user.last_name,
        }
        return data


class MembershipRoleAssignSerializer(serializers.Serializer):
    """Write serializer for assigning a role to a membership."""

    role_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of the role to assign. Send null to remove the role.",
    )

    def validate(self, attrs):
        from organizations.selectors import get_role_by_id

        role_id = attrs.get("role_id")
        organization = self.context["organization"]

        if role_id is not None:
            role = get_role_by_id(role_id, organization)
            if role is None:
                raise serializers.ValidationError(
                    {"role_id": ["Role not found in this organization."]}
                )
            attrs["role"] = role
        else:
            attrs["role"] = None

        return attrs

    def save(self, **kwargs):
        from organizations.services import RBACService

        membership = self.context["membership"]
        actor_membership = self.context["actor_membership"]
        role = self.validated_data["role"]
        return RBACService.assign_role_to_membership(
            membership=membership,
            role=role,
            actor_membership=actor_membership,
        )


class MembershipCreateSerializer(serializers.Serializer):
    """Write serializer for creating/adding an organization membership."""

    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        help_text="Email of the user to add as a member.",
    )
    user_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of the user to add as a member.",
    )
    role_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of the initial role to assign.",
    )

    def validate(self, attrs):
        from django.contrib.auth import get_user_model
        from organizations.selectors import get_role_by_id

        User = get_user_model()
        email = attrs.get("email")
        user_id = attrs.get("user_id")
        role_id = attrs.get("role_id")
        organization = self.context["organization"]

        if not email and not user_id:
            raise serializers.ValidationError(
                {"email": ["Either email or user_id must be provided."]}
            )

        user = None
        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    {"user_id": ["User with this ID does not exist."]}
                ) from None
        elif email:
            try:
                user = User.objects.get(email=email.strip().lower())
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    {"email": ["User with this email does not exist. Please register the user account first."]}
                ) from None

        attrs["user"] = user

        if role_id is not None:
            role = get_role_by_id(role_id, organization)
            if role is None:
                raise serializers.ValidationError(
                    {"role_id": ["Role not found in this organization."]}
                )
            attrs["role"] = role
        else:
            attrs["role"] = None

        return attrs

    def create(self, validated_data):
        organization = self.context["organization"]
        actor_membership = self.context.get("actor_membership")
        return OrganizationService.add_member(
            organization=organization,
            user=validated_data["user"],
            role=validated_data.get("role"),
            actor_membership=actor_membership,
        )


class MembershipStatusUpdateSerializer(serializers.Serializer):
    """Write serializer for updating a member's status (e.g. suspend or reactivate)."""

    status = serializers.ChoiceField(
        choices=MembershipStatus.choices,
        help_text="New membership status: ACTIVE, SUSPENDED, or REMOVED.",
    )

    def update(self, instance, validated_data):
        actor_membership = self.context["actor_membership"]
        return OrganizationService.update_member_status(
            membership=instance,
            status=validated_data["status"],
            actor_membership=actor_membership,
        )

