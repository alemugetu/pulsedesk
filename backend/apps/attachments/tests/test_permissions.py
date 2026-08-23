"""
Tests for attachment permission classes.

Verifies:
- Unauthenticated user is denied (CanViewIncidentAttachments, CanUploadAttachment)
- Non-member is denied
- Active member with incident.view is allowed
- CanDeleteAttachment: uploader passes object-level check
- CanDeleteAttachment: non-uploader without incident.manage is denied
- CanDeleteAttachment: non-uploader WITH incident.manage passes
"""

from attachments.permissions import (
    CanDeleteAttachment,
    CanUploadAttachment,
    CanViewIncidentAttachments,
)
from attachments.services import AttachmentService
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus, Permission, Role
from organizations.services import OrganizationService

User = get_user_model()

_PDF = b"%PDF-1.4 data"


def _make_request(user, organization=None):
    rf = RequestFactory()
    request = rf.get("/")
    request.user = user
    if organization is not None:
        request.organization = organization
    return request


def _give_permission(user, organization, codename):
    """Helper: assign an RBAC permission to user within org."""
    perm, _ = Permission.objects.get_or_create(
        codename=codename,
        defaults={
            "name": codename,
            "resource": codename.split(".")[0],
            "action": codename.split(".")[1],
        },
    )
    role, _ = Role.objects.get_or_create(
        organization=organization,
        slug=f"role-{codename.replace('.', '-')}",
        defaults={"name": f"Role {codename}"},
    )
    role.permissions.add(perm)
    Membership.objects.filter(user=user, organization=organization).update(role=role)


class CanViewIncidentAttachmentsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        _give_permission(self.user, self.org, "incident.view")

    def test_unauthenticated_denied(self):
        from django.contrib.auth.models import AnonymousUser

        request = _make_request(AnonymousUser(), self.org)
        perm = CanViewIncidentAttachments()
        self.assertFalse(perm.has_permission(request, None))

    def test_no_organization_on_request_denied(self):
        request = _make_request(self.user)
        perm = CanViewIncidentAttachments()
        self.assertFalse(perm.has_permission(request, None))

    def test_member_with_incident_view_allowed(self):
        request = _make_request(self.user, self.org)
        perm = CanViewIncidentAttachments()
        self.assertTrue(perm.has_permission(request, None))

    def test_member_without_incident_view_denied(self):
        other = User.objects.create_user(
            email="noperm@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        request = _make_request(other, self.org)
        perm = CanViewIncidentAttachments()
        self.assertFalse(perm.has_permission(request, None))


class CanUploadAttachmentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        _give_permission(self.user, self.org, "incident.view")

    def test_unauthenticated_denied(self):
        from django.contrib.auth.models import AnonymousUser

        request = _make_request(AnonymousUser(), self.org)
        perm = CanUploadAttachment()
        self.assertFalse(perm.has_permission(request, None))

    def test_member_with_incident_view_allowed(self):
        request = _make_request(self.user, self.org)
        perm = CanUploadAttachment()
        self.assertTrue(perm.has_permission(request, None))

    def test_member_without_permission_denied(self):
        other = User.objects.create_user(
            email="noperm@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        request = _make_request(other, self.org)
        perm = CanUploadAttachment()
        self.assertFalse(perm.has_permission(request, None))


class CanDeleteAttachmentTest(TestCase):
    def setUp(self):
        self.uploader = User.objects.create_user(
            email="uploader@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.uploader, name="Acme Corp"
        )
        self.incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.uploader,
            title="Inc",
            description="desc",
        )
        _give_permission(self.uploader, self.org, "incident.view")
        f = SimpleUploadedFile("doc.pdf", _PDF, content_type="application/pdf")
        self.attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.uploader, uploaded_file=f
        )

    def test_uploader_passes_object_permission(self):
        request = _make_request(self.uploader, self.org)
        perm = CanDeleteAttachment()
        self.assertTrue(perm.has_object_permission(request, None, self.attachment))

    def test_other_member_without_manage_denied(self):
        other = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        request = _make_request(other, self.org)
        perm = CanDeleteAttachment()
        self.assertFalse(perm.has_object_permission(request, None, self.attachment))

    def test_member_with_incident_manage_passes(self):
        manager = User.objects.create_user(
            email="manager@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=manager,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        _give_permission(manager, self.org, "incident.manage")
        request = _make_request(manager, self.org)
        perm = CanDeleteAttachment()
        self.assertTrue(perm.has_object_permission(request, None, self.attachment))

    def test_unauthenticated_view_level_denied(self):
        from django.contrib.auth.models import AnonymousUser

        request = _make_request(AnonymousUser())
        perm = CanDeleteAttachment()
        self.assertFalse(perm.has_permission(request, None))
