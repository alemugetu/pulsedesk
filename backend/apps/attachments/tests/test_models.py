"""
Tests for the Attachment model.

Validates:
- Valid attachment creation and field persistence
- Incident / uploader FK relationships
- Metadata fields (original_filename, content_type, file_size)
- Timestamps inherited from BaseModel
- String representation
- Model-level clean() validation
- Storage path generation (safe, UUID-based, never uses original filename as path)
- Cascade delete from incident
"""

import uuid

from attachments.models import Attachment, _attachment_upload_to
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from incidents.services import IncidentService
from organizations.services import OrganizationService

User = get_user_model()


class AttachmentModelTest(TestCase):
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
            description="Test description",
        )

    # ------------------------------------------------------------------
    # Field persistence
    # ------------------------------------------------------------------

    def test_attachment_creation_persists_fields(self):
        f = SimpleUploadedFile(
            "report.pdf", b"%PDF-1.4 content", content_type="application/pdf"
        )
        attachment = Attachment.objects.create(
            incident=self.incident,
            uploader=self.user,
            original_filename="report.pdf",
            file=f,
            content_type="application/pdf",
            file_size=16,
        )
        self.assertIsNotNone(attachment.id)
        self.assertIsInstance(attachment.id, uuid.UUID)
        self.assertEqual(attachment.original_filename, "report.pdf")
        self.assertEqual(attachment.content_type, "application/pdf")
        self.assertEqual(attachment.file_size, 16)
        self.assertEqual(attachment.incident, self.incident)
        self.assertEqual(attachment.uploader, self.user)
        self.assertIsNotNone(attachment.created_at)
        self.assertIsNotNone(attachment.updated_at)

    def test_attachment_incident_relationship(self):
        f = SimpleUploadedFile("log.txt", b"log content", content_type="text/plain")
        attachment = Attachment.objects.create(
            incident=self.incident,
            uploader=self.user,
            original_filename="log.txt",
            file=f,
            content_type="text/plain",
            file_size=11,
        )
        self.assertEqual(attachment.incident.id, self.incident.id)
        self.assertEqual(attachment.incident.organization, self.org)

    def test_attachment_uploader_relationship(self):
        f = SimpleUploadedFile("image.png", b"\x89PNG\r\n", content_type="image/png")
        attachment = Attachment.objects.create(
            incident=self.incident,
            uploader=self.user,
            original_filename="image.png",
            file=f,
            content_type="image/png",
            file_size=6,
        )
        self.assertEqual(attachment.uploader.email, self.user.email)

    def test_attachment_str_representation(self):
        f = SimpleUploadedFile("doc.pdf", b"%PDF", content_type="application/pdf")
        attachment = Attachment.objects.create(
            incident=self.incident,
            uploader=self.user,
            original_filename="doc.pdf",
            file=f,
            content_type="application/pdf",
            file_size=4,
        )
        expected = f"Attachment 'doc.pdf' on {self.incident.incident_number}"
        self.assertEqual(str(attachment), expected)

    # ------------------------------------------------------------------
    # Model-level clean() validation
    # ------------------------------------------------------------------

    def test_clean_empty_original_filename_raises(self):
        f = SimpleUploadedFile("x.pdf", b"%PDF", content_type="application/pdf")
        attachment = Attachment(
            incident=self.incident,
            uploader=self.user,
            original_filename="",
            file=f,
            content_type="application/pdf",
            file_size=4,
        )
        with self.assertRaises(ValidationError):
            attachment.clean()

    def test_clean_zero_file_size_raises(self):
        f = SimpleUploadedFile("x.pdf", b"%PDF", content_type="application/pdf")
        attachment = Attachment(
            incident=self.incident,
            uploader=self.user,
            original_filename="x.pdf",
            file=f,
            content_type="application/pdf",
            file_size=0,
        )
        with self.assertRaises(ValidationError):
            attachment.clean()

    # ------------------------------------------------------------------
    # Storage path safety
    # ------------------------------------------------------------------

    def test_upload_to_path_is_uuid_based_not_original_filename(self):
        """The on-disk name must be a UUID hex, not the original filename."""

        class FakeInstance:
            incident_id = uuid.uuid4()
            incident = type("I", (), {"organization_id": uuid.uuid4()})()

        path = _attachment_upload_to(FakeInstance(), "../../etc/passwd.pdf")
        # Must start with 'attachments/'  (forward slash, cross-platform)
        self.assertTrue(path.startswith("attachments/"))
        # Must NOT contain the original filename or dangerous traversal sequences
        self.assertNotIn("etc", path)
        self.assertNotIn("passwd", path)
        self.assertNotIn("..", path)
        # Extension should be preserved (lowercase)
        self.assertTrue(path.endswith(".pdf"))
        # The filename part (last segment) should be a UUID hex + ext
        filename_part = path.split("/")[-1]
        hex_part = filename_part.replace(".pdf", "")
        self.assertEqual(len(hex_part), 32)  # UUID hex is 32 chars

    def test_upload_to_path_structure(self):
        """Path should be: attachments/<org_id>/<incident_id>/<uuid>.ext"""

        org_id = uuid.uuid4()
        inc_id = uuid.uuid4()

        class FakeInstance:
            incident_id = inc_id
            incident = type("I", (), {"organization_id": org_id})()

        path = _attachment_upload_to(FakeInstance(), "photo.jpg")
        parts = path.split("/")
        self.assertEqual(parts[0], "attachments")
        self.assertEqual(parts[1], str(org_id))
        self.assertEqual(parts[2], str(inc_id))
        self.assertTrue(parts[3].endswith(".jpg"))

    # ------------------------------------------------------------------
    # Cascade delete
    # ------------------------------------------------------------------

    def test_attachment_deleted_when_incident_deleted(self):
        f = SimpleUploadedFile("log.txt", b"content", content_type="text/plain")
        attachment = Attachment.objects.create(
            incident=self.incident,
            uploader=self.user,
            original_filename="log.txt",
            file=f,
            content_type="text/plain",
            file_size=7,
        )
        attachment_id = attachment.id
        self.incident.delete()
        self.assertFalse(Attachment.objects.filter(id=attachment_id).exists())

    # ------------------------------------------------------------------
    # Multiple attachments on one incident
    # ------------------------------------------------------------------

    def test_multiple_attachments_on_same_incident(self):
        for i in range(3):
            f = SimpleUploadedFile(f"file{i}.txt", b"data", content_type="text/plain")
            Attachment.objects.create(
                incident=self.incident,
                uploader=self.user,
                original_filename=f"file{i}.txt",
                file=f,
                content_type="text/plain",
                file_size=4,
            )
        self.assertEqual(Attachment.objects.filter(incident=self.incident).count(), 3)

    # ------------------------------------------------------------------
    # ordering
    # ------------------------------------------------------------------

    def test_default_ordering_is_newest_first(self):
        for i in range(3):
            f = SimpleUploadedFile(f"f{i}.txt", b"x", content_type="text/plain")
            Attachment.objects.create(
                incident=self.incident,
                uploader=self.user,
                original_filename=f"f{i}.txt",
                file=f,
                content_type="text/plain",
                file_size=1,
            )
        attachments = list(Attachment.objects.filter(incident=self.incident))
        # Default ordering is -created_at (newest first)
        for i in range(len(attachments) - 1):
            self.assertGreaterEqual(
                attachments[i].created_at, attachments[i + 1].created_at
            )
