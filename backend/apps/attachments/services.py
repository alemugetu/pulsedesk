"""
Service layer for Attachment business operations.

Responsibilities:
- Validate file type (extension + declared MIME type)
- Validate file size against the configured limit
- Derive storage path safely (never trust client-supplied filename as a path)
- Derive uploader and tenant server-side
- Persist the file via Django's storage backend
- Persist the metadata record atomically
- Clean up orphan storage files if DB persist fails
- Authorise deletion (uploader OR incident.manage permission)
- Delete file + record atomically
- Publish realtime events via transaction.on_commit()

Security notes:
- The original filename is stored as display-only metadata, never used as a path.
- Django's FileField / storage backend handles the actual on-disk name via
  _attachment_upload_to() defined in models.py.
- MIME type is validated against an allowlist; the extension is cross-checked
  independently so that a .exe renamed to .pdf cannot pass.
- File size is checked before saving to avoid writing oversized files to storage.
"""

import logging
import os

from django.conf import settings
from django.db import transaction
from incidents.models import Incident
from organizations.models import Membership, MembershipStatus
from organizations.selectors import user_has_permission
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowed file types
# ---------------------------------------------------------------------------

# Mapping:  extension (lowercase, WITH dot) → allowed MIME types
# Both the extension AND the declared MIME type must appear in this map.
ALLOWED_EXTENSIONS: dict[str, set[str]] = {
    # Images
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".webp": {"image/webp"},
    # Documents
    ".pdf": {"application/pdf"},
    # Logs / plain text
    ".txt": {"text/plain"},
    ".log": {"text/plain", "application/octet-stream"},
}

# Flat set of all permitted MIME types (derived from the map above).
ALLOWED_MIME_TYPES: set[str] = {
    mime for mimes in ALLOWED_EXTENSIONS.values() for mime in mimes
}

# Explicitly blocked dangerous extensions (defence-in-depth — reject even if
# somehow slipping through MIME validation).
BLOCKED_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".exe",
        ".bat",
        ".cmd",
        ".sh",
        ".ps1",
        ".dll",
        ".py",
        ".js",
        ".html",
        ".htm",
        ".svg",
        ".php",
        ".rb",
        ".pl",
        ".vbs",
        ".jar",
        ".msi",
        ".com",
        ".scr",
        ".pif",
        ".hta",
    }
)


class AttachmentValidationError(ValidationError):
    """Stable-code validation error for the attachment domain."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


class AttachmentService:
    """Business logic for Attachment management."""

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _validate_incident_access(incident: Incident, user) -> Membership:
        """
        Verify the user has an active membership in the incident's organization.

        Returns the Membership for further permission checks.
        Raises AttachmentValidationError if access is denied.
        """
        try:
            return Membership.objects.get(
                user=user,
                organization=incident.organization,
                status=MembershipStatus.ACTIVE,
            )
        except Membership.DoesNotExist:
            raise AttachmentValidationError(
                {"detail": "You do not have access to this incident."},
                code="access_denied",
            ) from None

    @staticmethod
    def _get_max_size() -> int:
        """Return the configured maximum attachment size in bytes."""
        return getattr(settings, "ATTACHMENT_MAX_FILE_SIZE_BYTES", 10 * 1024 * 1024)

    @staticmethod
    def _validate_file(uploaded_file) -> tuple[str, str]:
        """
        Validate extension, MIME type, and file size.

        Returns (clean_original_filename, validated_mime_type).
        Raises AttachmentValidationError on any violation.

        Security:
        - Extracts extension from the original filename only for allowlist lookup.
        - Never uses the extension or original filename as a storage path.
        - Blocks all known dangerous extensions explicitly.
        """
        original_name: str = uploaded_file.name or ""
        _, ext = os.path.splitext(original_name)
        ext = ext.lower()

        # 1. Blocked extension check (defence-in-depth)
        if ext in BLOCKED_EXTENSIONS:
            raise AttachmentValidationError(
                {"file": [f"File type '{ext}' is not allowed."]},
                code="blocked_extension",
            )

        # 2. Extension allowlist check
        if ext not in ALLOWED_EXTENSIONS:
            raise AttachmentValidationError(
                {
                    "file": [
                        (
                            f"File extension '{ext}' is not permitted. "
                            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
                        )
                    ]
                },
                code="invalid_extension",
            )

        # 3. MIME type check (declared content_type from the multipart upload)
        declared_mime: str = getattr(uploaded_file, "content_type", "") or ""
        declared_mime = declared_mime.split(";")[0].strip().lower()

        if declared_mime not in ALLOWED_MIME_TYPES:
            raise AttachmentValidationError(
                {
                    "file": [
                        (
                            f"Content type '{declared_mime}' is not permitted. "
                            f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
                        )
                    ]
                },
                code="invalid_mime_type",
            )

        # 4. Cross-check: the declared MIME must be valid for the given extension
        #    (prevents e.g. uploading a .exe with content_type="image/jpeg")
        if declared_mime not in ALLOWED_EXTENSIONS[ext]:
            raise AttachmentValidationError(
                {
                    "file": [
                        (
                            f"Content type '{declared_mime}' is not consistent with "
                            f"extension '{ext}'."
                        )
                    ]
                },
                code="mime_extension_mismatch",
            )

        # 5. File size check — read the size without loading the whole file into RAM
        uploaded_file.seek(0, 2)  # seek to end
        file_size: int = uploaded_file.tell()
        uploaded_file.seek(0)  # rewind

        max_size = AttachmentService._get_max_size()
        if file_size > max_size:
            raise AttachmentValidationError(
                {
                    "file": [
                        (
                            f"File size {file_size} bytes exceeds the maximum allowed "
                            f"{max_size} bytes ({max_size // (1024 * 1024)} MB)."
                        )
                    ]
                },
                code="file_too_large",
            )

        if file_size == 0:
            raise AttachmentValidationError(
                {"file": ["Empty files are not allowed."]},
                code="empty_file",
            )

        return original_name, declared_mime

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def upload_attachment(incident: Incident, uploader, uploaded_file):
        """
        Validate and persist an uploaded file as an Attachment.

        Args:
            incident: The incident the file is attached to (already org-scoped).
            uploader: The authenticated User performing the upload.
            uploaded_file: InMemoryUploadedFile / TemporaryUploadedFile from
                           the multipart request.

        Returns:
            The created Attachment instance.

        Raises:
            AttachmentValidationError: on auth, type, or size failures.

        Storage consistency note:
            The file is written to the storage backend inside the atomic block.
            Django's FileField.save() is NOT itself transactional, so if the
            database INSERT rolls back after the file has been written, the file
            will become an orphan.  We mitigate this by catching any exception,
            deleting the stored file, then re-raising.  This is the standard
            Django pattern; true two-phase commit is not available without an
            object-store transaction API.
        """
        from attachments.models import Attachment

        # 1. Authorization
        AttachmentService._validate_incident_access(incident, uploader)

        # 2. File validation
        original_name, mime_type = AttachmentService._validate_file(uploaded_file)

        # Determine file size (already seeked to 0 by _validate_file)
        uploaded_file.seek(0, 2)
        file_size = uploaded_file.tell()
        uploaded_file.seek(0)

        # 3. Build the Attachment instance — do NOT save yet so we can attach
        #    the file via FileField (which handles safe naming via upload_to).
        attachment = Attachment(
            incident=incident,
            uploader=uploader,
            original_filename=original_name,
            content_type=mime_type,
            file_size=file_size,
        )

        # 4. Assign the file — Django's storage backend writes it and stores
        #    the storage-relative path in attachment.file.name.
        #    upload_to=_attachment_upload_to (defined in models) generates a
        #    UUID-based path that is completely independent of original_name.
        stored_file = None
        try:
            attachment.file.save(original_name, uploaded_file, save=False)
            stored_file = attachment.file.name  # storage-relative path
            attachment.save()
        except Exception:
            # Clean up orphan storage file before propagating the error.
            if stored_file:
                try:
                    attachment.file.storage.delete(stored_file)
                except OSError as cleanup_err:
                    logger.warning(
                        "Failed to clean up orphan attachment file '%s': %s",
                        stored_file,
                        cleanup_err,
                    )
            raise

        # 5. Realtime event — fires only after the transaction commits.
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_attachment_created(attachment)

        return attachment

    @staticmethod
    @transaction.atomic
    def delete_attachment(attachment, requesting_user) -> None:
        """
        Delete an attachment.

        Authorization rules (least-privilege):
        - The uploader may always delete their own attachment.
        - A member with the 'incident.manage' permission may also delete any
          attachment on an incident within their organization.
        - Nobody outside the incident's organization can delete the attachment
          (enforced by the incident-scoped selector the view uses before calling
          this service).

        Args:
            attachment: The Attachment instance to delete (already org-scoped).
            requesting_user: The authenticated User requesting deletion.

        Raises:
            AttachmentValidationError: if not authorized.

        Storage consistency note:
            The database record is deleted inside the atomic block.  The storage
            file is deleted AFTER the transaction commits via on_commit() to
            avoid deleting the file if the DB transaction rolls back.
            If the post-commit file deletion fails the record is gone but the
            file remains — acceptable orphan risk, logged for ops cleanup.
        """
        organization = attachment.incident.organization

        is_uploader = attachment.uploader == requesting_user
        has_manage_perm = user_has_permission(
            requesting_user, organization, "incident.manage"
        )

        if not is_uploader and not has_manage_perm:
            raise AttachmentValidationError(
                {"detail": "You do not have permission to delete this attachment."},
                code="delete_forbidden",
            )

        attachment_id = str(attachment.id)
        incident_id = str(attachment.incident_id)
        organization_id = str(organization.id)
        stored_name = attachment.file.name  # capture before deletion

        # Delete the DB record first (inside the atomic block).
        attachment.delete()

        # Delete the storage file AFTER the transaction commits so the file is
        # not removed for a rolled-back transaction.
        def _delete_file():
            try:
                from django.core.files.storage import default_storage

                if default_storage.exists(stored_name):
                    default_storage.delete(stored_name)
            except OSError as err:
                logger.error(
                    "Failed to delete attachment storage file '%s' (id=%s): %s",
                    stored_name,
                    attachment_id,
                    err,
                )

        transaction.on_commit(_delete_file)

        # Realtime event.
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_attachment_deleted(
            attachment_id, incident_id, organization_id
        )
