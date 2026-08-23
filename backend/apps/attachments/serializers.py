"""
Serializers for the Attachments module.

Design decisions:
- AttachmentUploadSerializer handles multipart/form-data input.
  It only exposes the `file` field — uploader, tenant, and stored path are
  all derived server-side and must never be accepted from the client.
- AttachmentSerializer (output) returns safe metadata only.
  It intentionally omits the internal storage path (attachment.file.name).
- A separate `download_url` field provides the authorized download endpoint
  URL so the client never needs the raw storage path.
"""

from typing import ClassVar

from attachments.models import Attachment
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class AttachmentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for Attachment metadata.

    Intentionally omits:
    - file.name  (internal storage path)
    - Any server credentials or internal configuration

    Provides:
    - download_url  (relative URL to the authorized download endpoint)
    - uploader      (safe user summary)
    """

    uploader = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields: ClassVar = [
            "id",
            "incident",
            "uploader",
            "original_filename",
            "content_type",
            "file_size",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = [
            "id",
            "incident",
            "uploader",
            "original_filename",
            "content_type",
            "file_size",
            "download_url",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(dict)
    def get_uploader(self, obj):
        """Return safe uploader summary."""
        return {
            "id": str(obj.uploader.id),
            "email": obj.uploader.email,
            "first_name": obj.uploader.first_name,
            "last_name": obj.uploader.last_name,
        }

    @extend_schema_field(str)
    def get_download_url(self, obj):
        """
        Return the relative URL to the authorized download endpoint.

        The URL follows the project's nested-resource convention:
          /api/v1/organizations/<org_id>/incidents/<incident_id>/attachments/<attachment_id>/download/
        """
        request = self.context.get("request")
        organization_id = str(obj.incident.organization_id)
        incident_id = str(obj.incident_id)
        attachment_id = str(obj.id)

        path = (
            f"/api/v1/organizations/{organization_id}"
            f"/incidents/{incident_id}"
            f"/attachments/{attachment_id}/download/"
        )

        if request is not None:
            return request.build_absolute_uri(path)
        return path


class AttachmentUploadSerializer(serializers.Serializer):
    """
    Serializer for multipart/form-data file upload.

    Only accepts `file` — all other fields (uploader, organization, incident,
    storage path) are derived server-side.
    """

    file = serializers.FileField(
        required=True,
        allow_empty_file=False,
        help_text=(
            "The file to upload. "
            "Allowed types: JPEG, PNG, WebP (images), PDF (documents), "
            "TXT/LOG (logs). "
            "Maximum size is configured server-side (default 10 MB)."
        ),
    )

    def validate_file(self, value):
        """
        Perform basic DRF-level validation.

        Deep validation (MIME/extension cross-check, size limit) is handled
        by AttachmentService._validate_file() to keep validation logic in one
        authoritative place.
        """
        if not value:
            raise serializers.ValidationError("No file was submitted.")
        return value
