from typing import ClassVar

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = ("id",)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": ["Passwords do not match."]}
            )

        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        from accounts.services import AuthService

        return AuthService.register_user(**validated_data)


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, style={"input_type": "password"})

    def validate(self, attrs):
        from accounts.services import AuthService

        try:
            return AuthService.login_user(attrs["email"], attrs["password"])
        except ValidationError as exc:
            raise serializers.ValidationError(exc.detail) from exc


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for the authenticated user profile."""

    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_verified",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = fields


class LogoutSerializer(serializers.Serializer):
    """Serializer for logout."""

    refresh = serializers.CharField(required=True)


class EmailVerificationSerializer(serializers.Serializer):
    """Serializer for email verification."""

    token = serializers.CharField(required=True)


class ResendVerificationSerializer(serializers.Serializer):
    """Serializer for resending verification email."""

    email = serializers.EmailField(required=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request."""

    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""

    user_id = serializers.UUIDField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(
        required=True, style={"input_type": "password"}
    )
    new_password_confirm = serializers.CharField(
        required=True, style={"input_type": "password"}
    )

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": ["Passwords do not match."]}
            )
        return attrs
