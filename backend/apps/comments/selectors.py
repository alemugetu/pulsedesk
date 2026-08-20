from django.core.exceptions import ValidationError as DjangoValidationError
from incidents.models import Incident


def get_comments(incident: Incident):
    """
    Return all comments for an incident.

    Comments are automatically tenant-isolated through the incident's
    organization relationship. The incident must be validated to belong
    to the requesting organization before calling this selector.

    Args:
        incident: The incident to get comments for

    Returns:
        QuerySet of comments ordered by creation time
    """
    from comments.models import Comment

    return (
        Comment.objects.filter(incident=incident)
        .select_related("author", "incident")
        .prefetch_related("mentioned_users")
        .order_by("created_at")
    )


def get_comment(incident: Incident, comment_id):
    """
    Retrieve a single comment by UUID scoped to an incident.

    Ensures tenant isolation by validating the comment belongs to
    the specified incident (which is already organization-scoped).

    Args:
        incident: The incident the comment should belong to
        comment_id: UUID of the comment

    Returns:
        Comment instance or None if not found
    """
    from comments.models import Comment

    try:
        return (
            Comment.objects.select_related("author", "incident")
            .prefetch_related("mentioned_users")
            .get(
                id=comment_id,
                incident=incident,
            )
        )
    except (Comment.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None
