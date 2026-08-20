from comments.models import Comment
from django.db import transaction
from incidents.models import Incident
from organizations.models import Membership, MembershipStatus
from rest_framework.exceptions import ValidationError


class CommentValidationError(ValidationError):
    """Validation error that preserves a stable error code."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


class CommentService:
    """Business logic for Comment management."""

    @staticmethod
    def _validate_incident_access(incident: Incident, user) -> Membership:
        """
        Validate that the user has active membership in the incident's organization.

        Returns the user's membership for further authorization checks.

        Raises CommentValidationError if access is denied.
        """
        try:
            membership = Membership.objects.get(
                user=user,
                organization=incident.organization,
                status=MembershipStatus.ACTIVE,
            )
            return membership
        except Membership.DoesNotExist:
            raise CommentValidationError(
                {"detail": "You do not have access to this incident."},
                code="access_denied",
            ) from None

    @staticmethod
    def _validate_and_resolve_mentions(incident: Incident, body: str) -> list:
        """
        Validate and resolve mentioned users from comment body.

        Ensures all mentioned users are active members of the incident's organization.
        Returns list of validated User objects.

        Raises CommentValidationError if cross-tenant mentions are detected.
        """
        from accounts.models import User

        mentioned_usernames = Comment.extract_mentions(body)
        if not mentioned_usernames:
            return []

        validated_users = []
        for username in mentioned_usernames:
            try:
                # Find user by username (email in our case)
                user = User.objects.get(email__iexact=username)

                # Verify user is active member of the incident's organization
                membership = Membership.objects.filter(
                    user=user,
                    organization=incident.organization,
                    status=MembershipStatus.ACTIVE,
                ).first()

                if not membership:
                    raise CommentValidationError(
                        {
                            "body": [
                                f"@{username} is not a member of this organization."
                            ]
                        },
                        code="invalid_mention",
                    )

                validated_users.append(user)

            except User.DoesNotExist:
                # Silently ignore mentions of non-existent users
                # (don't fail comment creation for invalid mentions)
                continue

        return validated_users

    @staticmethod
    @transaction.atomic
    def create_comment(
        incident: Incident,
        author,
        body: str,
        is_internal: bool = False,
    ):
        """
        Create a new comment on an incident.

        Args:
            incident: The incident to comment on
            author: The authenticated user creating the comment
            body: The comment text content
            is_internal: Whether this is an internal note

        Returns:
            The created Comment instance

        Raises:
            CommentValidationError: If validation fails
        """
        # Validate incident access
        CommentService._validate_incident_access(incident, author)

        # Validate body is not empty
        clean_body = body.strip() if body else ""
        if not clean_body:
            raise CommentValidationError(
                {"body": ["Comment body cannot be empty."]},
                code="empty_body",
            )

        # Validate and resolve mentions
        mentioned_users = CommentService._validate_and_resolve_mentions(
            incident, clean_body
        )

        # Create comment (author is derived from authenticated user, not client input)
        comment = Comment.objects.create(
            incident=incident,
            author=author,
            body=clean_body,
            is_internal=is_internal,
        )

        # Add validated mentions
        if mentioned_users:
            comment.mentioned_users.set(mentioned_users)

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_comment_created(comment)

        return comment

    @staticmethod
    @transaction.atomic
    def update_comment(
        comment,
        author,
        body: str | None = None,
        is_internal: bool | None = None,
    ):
        """
        Update an existing comment.

        Only the comment author may update their own comments.

        Args:
            comment: The comment to update
            author: The authenticated user attempting the update
            body: New comment body (optional)
            is_internal: New internal note status (optional)

        Returns:
            The updated Comment instance

        Raises:
            CommentValidationError: If validation fails or unauthorized
        """
        # Verify ownership
        if comment.author != author:
            raise CommentValidationError(
                {"detail": "You can only edit your own comments."},
                code="not_owner",
            )

        # Validate body if provided
        if body is not None:
            clean_body = body.strip()
            if not clean_body:
                raise CommentValidationError(
                    {"body": ["Comment body cannot be empty."]},
                    code="empty_body",
                )
            comment.body = clean_body

        # Update internal status if provided
        if is_internal is not None:
            comment.is_internal = is_internal

        # Re-validate mentions if body changed
        if body is not None:
            mentioned_users = CommentService._validate_and_resolve_mentions(
                comment.incident, comment.body
            )
            comment.mentioned_users.set(mentioned_users)

        comment.save()

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_comment_updated(comment)

        return comment

    @staticmethod
    @transaction.atomic
    def delete_comment(comment, author):
        """
        Delete a comment.

        Only the comment author may delete their own comments.

        Args:
            comment: The comment to delete
            author: The authenticated user attempting the deletion

        Raises:
            CommentValidationError: If unauthorized
        """
        # Verify ownership
        if comment.author != author:
            raise CommentValidationError(
                {"detail": "You can only delete your own comments."},
                code="not_owner",
            )

        comment_id = str(comment.id)
        incident_id = str(comment.incident_id)

        # Delete the comment
        comment.delete()

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_comment_deleted(
            comment_id, incident_id, str(comment.incident.organization_id)
        )
