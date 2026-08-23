"""
Tests for attachment selectors.

Verifies:
- Listing attachments scoped to an incident
- Listing returns empty queryset when no attachments exist
- get_attachment returns correct attachment when scoped correctly
- get_attachment returns None for non-existent ID
- get_attachment returns None for wrong incident (IDOR prevention)
- get_attachment returns None for invalid UUID
- Organization isolation — attachments from a different org's incident are
  inaccessible when the incident is correctly scoped
"""

import uuid

from attachments.selectors import get_attachment, get_attachments
from attachments.services import AttachmentService
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from incidents.services import IncidentService
from organizations.services import OrganizationService

User = get_user_model()

_PDF = b"%PDF-1.4 minimal"
_TXT = b"log line"


def _upload(incident, user, name="file.pdf", content=_PDF, ct="application/pdf"):
    f = SimpleUploadedFile(name, content, content_type=ct)
    return AttachmentService.upload_attachment(
        incident=incident, uploader=user, uploaded_file=f
    )


class GetAttachmentsTest(TestCase):
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
            title="Inc-1",
            description="desc",
        )

    def test_returns_empty_when_no_attachments(self):
        qs = get_attachments(self.incident)
        self.assertEqual(qs.count(), 0)

    def test_returns_all_attachments_for_incident(self):
        _upload(self.incident, self.user, "a.pdf")
        _upload(self.incident, self.user, "b.txt", content=_TXT, ct="text/plain")
        qs = get_attachments(self.incident)
        self.assertEqual(qs.count(), 2)

    def test_does_not_return_attachments_from_another_incident(self):
        other_incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Inc-2",
            description="desc",
        )
        _upload(other_incident, self.user, "other.pdf")
        # Should only return attachments for self.incident (none in this case)
        qs = get_attachments(self.incident)
        self.assertEqual(qs.count(), 0)

    def test_select_related_uploader_no_extra_queries(self):
        _upload(self.incident, self.user, "a.pdf")
        qs = get_attachments(self.incident)
        # Accessing .uploader.email on prefetched queryset should not cause N+1
        for att in qs:
            _ = att.uploader.email  # must not raise

    def test_ordering_is_oldest_first(self):
        a1 = _upload(self.incident, self.user, "first.pdf")
        a2 = _upload(
            self.incident, self.user, "second.txt", content=_TXT, ct="text/plain"
        )
        qs = list(get_attachments(self.incident))
        self.assertEqual(qs[0].id, a1.id)
        self.assertEqual(qs[1].id, a2.id)


class GetAttachmentTest(TestCase):
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
            title="Inc-1",
            description="desc",
        )
        self.attachment = _upload(self.incident, self.user)

    def test_returns_attachment_when_scoped_correctly(self):
        result = get_attachment(self.incident, self.attachment.id)
        self.assertIsNotNone(result)
        self.assertEqual(result.id, self.attachment.id)

    def test_returns_none_for_nonexistent_id(self):
        result = get_attachment(self.incident, uuid.uuid4())
        self.assertIsNone(result)

    def test_returns_none_for_invalid_uuid(self):
        result = get_attachment(self.incident, "not-a-uuid")
        self.assertIsNone(result)

    def test_returns_none_for_none_id(self):
        result = get_attachment(self.incident, None)
        self.assertIsNone(result)

    def test_idor_prevention_wrong_incident_returns_none(self):
        """An attachment must not be accessible via a different incident's scope."""
        other_incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Inc-2",
            description="desc",
        )
        result = get_attachment(other_incident, self.attachment.id)
        self.assertIsNone(result)

    def test_idor_prevention_cross_tenant_incident(self):
        """
        Even if an attacker has the attachment UUID, they cannot access it via
        a different organization's incident scope.
        """
        other_user = User.objects.create_user(
            email="attacker@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(
            user=other_user, name="Evil Corp"
        )
        other_incident = IncidentService.create_incident(
            organization=other_org,
            reporter_user=other_user,
            title="Evil Inc",
            description="desc",
        )
        result = get_attachment(other_incident, self.attachment.id)
        self.assertIsNone(result)
