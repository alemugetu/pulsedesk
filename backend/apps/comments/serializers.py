from typing import ClassVar

from comments.models import Comment
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class MentionedUserSerializer(serializers.Serializer):
    """Serializer for mentioned user information."""

    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField(allow_blank=True, required=False)
    last_name = serializers.CharField(allow_blank=True, required=False)


class CommentSerializer(serializers.ModelSerializer):
    """
    Serializer for Comment model.

    Includes author information and mentioned users.
    """

    author = serializers.SerializerMethodField()
    mentioned_users = MentionedUserSerializer(many=True, read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields: ClassVar = [
            "id",
            "incident",
            "author",
            "body",
            "is_internal",
            "mentioned_users",
            "is_owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = [
            "id",
            "incident",
            "author",
            "mentioned_users",
            "is_owner",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(dict)
    def get_author(self, obj):
        """Return author information."""
        return {
            "id": str(obj.author.id),
            "email": obj.author.email,
            "first_name": obj.author.first_name,
            "last_name": obj.author.last_name,
            "full_name": obj.author.full_name,
        }

    @extend_schema_field(bool)
    def get_is_owner(self, obj):
        """Return whether the current user is the comment author."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return obj.author == request.user
        return False


class CommentCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a comment.

    Does not include author or incident - these are derived from
    the authenticated request and URL parameters.
    """

    body = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Comment text content. Supports @username mentions.",
    )
    is_internal = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether this is an internal note (only visible to organization members).",
    )

    def validate_body(self, value):
        """Validate that body is not empty after stripping."""
        clean_body = value.strip() if value else ""
        if not clean_body:
            raise serializers.ValidationError("Comment body cannot be empty.")
        return clean_body


class CommentUpdateSerializer(serializers.Serializer):
    """
    Serializer for updating a comment.

    Only the comment author may update their own comments.
    """

    body = serializers.CharField(
        required=False,
        allow_blank=False,
        help_text="Updated comment text content.",
    )
    is_internal = serializers.BooleanField(
        required=False,
        help_text="Updated internal note status.",
    )

    def validate_body(self, value):
        """Validate that body is not empty after stripping if provided."""
        if value is not None:
            clean_body = value.strip()
            if not clean_body:
                raise serializers.ValidationError("Comment body cannot be empty.")
            return clean_body
        return value
