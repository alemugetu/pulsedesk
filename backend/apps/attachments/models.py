"""
Attachment model for PulseDesk.

Design decisions:
- Binary content is stored on the filesystem / configurable Django storage backend,
  NOT in PostgreSQL.  The model only stores metadata and the storage-relative path.
- `stored_path` is the relative path returned by Django's storage backend (i.e. the
  value stored in the FileField, which is the name within MEDIA_ROOT / the bucket).
  It is never exposed directly to API clients.
- `original_filename` preserves the name the uploader provided — for display only.
- Tenant isolation is enforced through the incident → organization FK chain.
- UUIDs are used for every primary key, consistent with BaseModel.
"""

import os
import uuid
from typing import ClassVar

from common.models import BaseModel
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def _attachment_upload_to(instance: "Attachment", filename: str) -> str:
    """
    Compute the storage-relative path for an attachment.

    Path structure (forward slashes, portable for all storage backends):
      attachments/<organization_id>/<incident_id>/<uuid4><safe_ext>

    The original filename is intentionally NOT used as the on-disk name to
    prevent path traversal and filename-based attacks.  The original filename
    is preserved only in the `original_filename` metadata column.
    """
    # Only keep the extension (already validated by the service layer).
    ext = os.path.splitext(filename)[1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    # Use forward slashes explicitly — Django storage backends expect them
    # and this works cross-platform (Django normalises them internally).
    return "/".join(
        [
            "attachments",
            str(instance.incident.organization_id),
            str(instance.incident_id),
            safe_name,
        ]
    )


class Attachment(BaseModel):
    """
    A file attached to an Incident within an organization.

    Tenant isolation is enforced through the incident's organization FK.
    Do not query Attachment without scoping to an incident or organization.
    """

    incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_attachments",
    )
    # Human-readable name shown to users — derived from the upload, never
    # used as a filesystem path.
    original_filename = models.CharField(
        max_length=255,
        help_text="Original filename provided by the uploader (display only).",
    )
    # Django FileField stores the storage-relative path (e.g. the value
    # returned by _attachment_upload_to).  Never expose this path in API
    # responses.
    file = models.FileField(
        upload_to=_attachment_upload_to,
        help_text="Storage-relative path managed by Django's storage backend.",
    )
    content_type = models.CharField(
        max_length=100,
        help_text="MIME type declared and/or validated at upload time.",
    )
    file_size = models.PositiveIntegerField(
        help_text="File size in bytes.",
    )

    class Meta:
        db_table = "attachments"
        verbose_name = "Attachment"
        verbose_name_plural = "Attachments"
        ordering: ClassVar = ["-created_at"]
        indexes: ClassVar = [
            models.Index(fields=["incident", "created_at"]),
            models.Index(fields=["uploader"]),
        ]

    def __str__(self) -> str:
        return (
            f"Attachment '{self.original_filename}' on {self.incident.incident_number}"
        )

    def clean(self) -> None:
        """Model-level validation for metadata sanity."""
        if not self.original_filename or not self.original_filename.strip():
            raise ValidationError({"original_filename": "Filename cannot be empty."})
        if self.file_size is not None and self.file_size <= 0:
            raise ValidationError({"file_size": "File size must be positive."})
