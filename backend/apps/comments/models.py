import re
from typing import ClassVar

from common.models import BaseModel
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Comment(BaseModel):
    """
    Comment entity associated with an Incident within an organization.

    Comments support user mentions (@username) and internal notes.
    Tenant isolation is enforced through the incident's organization relationship.
    """

    incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="comments",
    )
    body = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        help_text="Internal notes are only visible to organization members.",
    )
    mentioned_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="mentioned_in_comments",
    )

    class Meta:
        db_table = "comments"
        verbose_name = "Comment"
        verbose_name_plural = "Comments"
        ordering: ClassVar = ["created_at"]
        indexes: ClassVar = [
            models.Index(fields=["incident", "created_at"]),
            models.Index(fields=["author"]),
            models.Index(fields=["is_internal"]),
        ]

    def __str__(self) -> str:
        return f"Comment by {self.author.email} on {self.incident.incident_number}"

    def clean(self):
        """Validate comment body is not empty."""
        if not self.body or not self.body.strip():
            raise ValidationError({"body": ["Comment body cannot be empty."]})

    @staticmethod
    def extract_mentions(text: str) -> list[str]:
        """
        Extract @username mentions from comment text.

        Returns list of usernames without the @ prefix.
        """
        if not text:
            return []

        # Match @username pattern (email format for our system)
        # Match @ followed by email-like pattern
        mention_pattern = r"@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"
        mentions = re.findall(mention_pattern, text)
        return list(set(mentions))  # Remove duplicates
