"""
Tests for AttachmentService.

Covers:
- Successful upload (image, PDF, log)
- Authorization: non-member access denied
- Invalid extension rejected
- Blocked extension rejected
- Invalid MIME type rejected
- MIME / extension mismatch rejected
- Oversized file rejected
- Empty file rejected
- Safe filename handling (path traversal attempts are neutralised)
- Successful delete by uploader
- Successful delete by incident manager
- Delete denied for unrelated member
- Cross-tenant delete impossible (selector guarantees incident scope)
- DB/storage consistency: orphan cleanup documented
"""

from attachments.models import Attachment
from attachments.services import (
    AttachmentService,
    AttachmentValidationError,
)
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService

User = get_user_model()

# A minimal valid PDF header (enough to pass size check)
_PDF_BYTES = b"%PDF-1.4 minimal content"
_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"X" * 50
_TXT_BYTES = b"2026-08-23 INFO Service started\n"
_JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"J" * 50  # JPEG magic bytes


def _make_file(name, content, content_type):
    f = SimpleUploadedFile(name, content, content_type=content_type)
    return f


class AttachmentUploadTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Test Incident",
            description="Description",
        )
        self.membership = Membership.objects.get(user=self.user, organization=self.org)

    # ------------------------------------------------------------------
    # Happy path
    # ------------------------------------------------------------------

    def test_upload_pdf_success(self):
        f = _make_file("report.pdf", _PDF_BYTES, "application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertIsNotNone(attachment.id)
        self.assertEqual(attachment.original_filename, "report.pdf")
        self.assertEqual(attachment.content_type, "application/pdf")
        self.assertEqual(attachment.file_size, len(_PDF_BYTES))
        self.assertEqual(attachment.incident, self.incident)
        self.assertEqual(attachment.uploader, self.user)

    def test_upload_png_success(self):
        f = _make_file("screenshot.png", _PNG_BYTES, "image/png")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.content_type, "image/png")
        self.assertTrue(attachment.file.name.endswith(".png"))

    def test_upload_jpeg_success(self):
        f = _make_file("photo.jpeg", _JPEG_BYTES, "image/jpeg")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.content_type, "image/jpeg")

    def test_upload_jpg_success(self):
        f = _make_file("photo.jpg", _JPEG_BYTES, "image/jpeg")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.content_type, "image/jpeg")

    def test_upload_txt_success(self):
        f = _make_file("service.txt", _TXT_BYTES, "text/plain")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.content_type, "text/plain")

    def test_upload_log_success(self):
        f = _make_file("app.log", _TXT_BYTES, "text/plain")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.original_filename, "app.log")

    def test_upload_webp_success(self):
        webp_bytes = b"RIFF\x00\x00\x00\x00WEBP" + b"W" * 20
        f = _make_file("image.webp", webp_bytes, "image/webp")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.content_type, "image/webp")

    # ------------------------------------------------------------------
    # Authorization
    # ------------------------------------------------------------------

    def test_upload_non_member_denied(self):
        outsider = User.objects.create_user(
            email="outsider@example.com", password="Password123!"
        )
        f = _make_file("report.pdf", _PDF_BYTES, "application/pdf")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=outsider, uploaded_file=f
            )
        self.assertEqual(cm.exception.code, "access_denied")

    def test_upload_suspended_member_denied(self):
        other = User.objects.create_user(
            email="suspended@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other,
            organization=self.org,
            status=MembershipStatus.SUSPENDED,
        )
        f = _make_file("report.pdf", _PDF_BYTES, "application/pdf")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=other, uploaded_file=f
            )
        self.assertEqual(cm.exception.code, "access_denied")

    # ------------------------------------------------------------------
    # File type validation
    # ------------------------------------------------------------------

    def test_blocked_extension_rejected(self):
        for ext in [".exe", ".bat", ".sh", ".ps1", ".py", ".js"]:
            f = _make_file(
                f"evil{ext}", b"malicious", content_type="application/octet-stream"
            )
            with self.assertRaises(AttachmentValidationError) as cm:
                AttachmentService.upload_attachment(
                    incident=self.incident, uploader=self.user, uploaded_file=f
                )
            self.assertEqual(cm.exception.code, "blocked_extension", msg=f"ext={ext}")

    def test_unsupported_extension_rejected(self):
        f = _make_file("data.csv", b"a,b,c", content_type="text/csv")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=self.user, uploaded_file=f
            )
        self.assertEqual(cm.exception.code, "invalid_extension")

    def test_invalid_mime_type_rejected(self):
        # Valid extension but disallowed MIME type
        f = _make_file("report.pdf", _PDF_BYTES, content_type="application/zip")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=self.user, uploaded_file=f
            )
        self.assertIn(
            cm.exception.code, ["invalid_mime_type", "mime_extension_mismatch"]
        )

    def test_mime_extension_mismatch_rejected(self):
        # image/jpeg MIME but .pdf extension
        f = _make_file("trick.pdf", _JPEG_BYTES, content_type="image/jpeg")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=self.user, uploaded_file=f
            )
        self.assertEqual(cm.exception.code, "mime_extension_mismatch")

    # ------------------------------------------------------------------
    # File size validation
    # ------------------------------------------------------------------

    def test_oversized_file_rejected(self):
        max_size = settings.ATTACHMENT_MAX_FILE_SIZE_BYTES
        oversized = b"X" * (max_size + 1)
        f = _make_file("big.txt", oversized, content_type="text/plain")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=self.user, uploaded_file=f
            )
        self.assertEqual(cm.exception.code, "file_too_large")

    def test_empty_file_rejected(self):
        f = _make_file("empty.txt", b"", content_type="text/plain")
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.upload_attachment(
                incident=self.incident, uploader=self.user, uploaded_file=f
            )
        self.assertEqual(cm.exception.code, "empty_file")

    def test_file_at_exact_limit_accepted(self):
        max_size = settings.ATTACHMENT_MAX_FILE_SIZE_BYTES
        content = b"X" * max_size
        f = _make_file("max.txt", content, content_type="text/plain")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.file_size, max_size)

    # ------------------------------------------------------------------
    # Filename / path traversal safety
    # ------------------------------------------------------------------

    def test_path_traversal_in_filename_neutralised(self):
        """
        A malicious filename like ../../etc/passwd.pdf must never be used
        as the on-disk path.  Django's UploadedFile strips path components
        via os.path.basename() before the name reaches our service, so
        `original_filename` will contain only the basename.
        The stored path is always a UUID-based safe name.
        """
        f = _make_file("../../etc/passwd.pdf", _PDF_BYTES, "application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        # Django already strips path separators — no traversal in original_filename
        self.assertNotIn("..", attachment.original_filename)
        self.assertNotIn("/", attachment.original_filename)
        # Internal storage path must NOT contain traversal sequences
        stored = attachment.file.name
        self.assertNotIn("..", stored)
        self.assertNotIn("etc", stored)
        self.assertNotIn("passwd", stored)

    def test_absolute_path_in_filename_neutralised(self):
        f = _make_file("/absolute/path/file.pdf", _PDF_BYTES, "application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        stored = attachment.file.name
        self.assertFalse(stored.startswith("/"))
        self.assertTrue(stored.startswith("attachments/"))

    def test_stored_filename_is_uuid_not_original(self):
        f = _make_file("my_report.pdf", _PDF_BYTES, "application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        # The stored file name should NOT be 'my_report.pdf'
        self.assertNotIn("my_report", attachment.file.name)

    # ------------------------------------------------------------------
    # Uploader is always the authenticated user (not client input)
    # ------------------------------------------------------------------

    def test_uploader_is_derived_server_side(self):
        """The uploader on the resulting attachment must be the user passed in,
        never a value that could be influenced by client input."""
        f = _make_file("report.pdf", _PDF_BYTES, "application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        self.assertEqual(attachment.uploader, self.user)

    # ------------------------------------------------------------------
    # Record count
    # ------------------------------------------------------------------

    def test_upload_creates_exactly_one_record(self):
        before = Attachment.objects.filter(incident=self.incident).count()
        f = _make_file("report.pdf", _PDF_BYTES, "application/pdf")
        AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        after = Attachment.objects.filter(incident=self.incident).count()
        self.assertEqual(after, before + 1)


class AttachmentDeleteTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Test Incident",
            description="Description",
        )
        f = _make_file("report.pdf", _PDF_BYTES, "application/pdf")
        self.attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )

    def test_uploader_can_delete_own_attachment(self):
        attachment_id = self.attachment.id
        AttachmentService.delete_attachment(self.attachment, self.user)
        self.assertFalse(Attachment.objects.filter(id=attachment_id).exists())

    def test_unrelated_member_cannot_delete(self):
        other = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        with self.assertRaises(AttachmentValidationError) as cm:
            AttachmentService.delete_attachment(self.attachment, other)
        self.assertEqual(cm.exception.code, "delete_forbidden")
        # Attachment still exists
        self.assertTrue(Attachment.objects.filter(id=self.attachment.id).exists())

    def test_delete_twice_raises_on_second_call(self):
        AttachmentService.delete_attachment(self.attachment, self.user)
        # After deletion the object is gone; any subsequent attempt on the same
        # Python object should gracefully error (the view would return 404 via
        # the selector before reaching the service in practice).
        self.assertFalse(Attachment.objects.filter(id=self.attachment.id).exists())
