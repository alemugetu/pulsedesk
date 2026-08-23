"""
API / view-level tests for the Attachments module.

Covers:
- GET list: authenticated member, empty list, paginated list
- POST upload: image, PDF, log — success cases
- POST upload: reject unsupported extension, blocked extension, oversized file, empty file
- POST upload: unauthenticated denied, non-member denied
- POST upload: client cannot override uploader / tenant / stored path
- GET download: authorized download, correct headers, not found
- GET download: unauthenticated denied, wrong-org denied
- DELETE: uploader can delete
- DELETE: unrelated member cannot delete (403)
- DELETE: unauthenticated denied (401)
- Cross-tenant access: wrong organization returns 404
- Invalid incident ID returns 404
- Invalid attachment ID returns 404
- Malformed multipart request handled gracefully
"""

from attachments.models import Attachment
from attachments.services import AttachmentService
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus, Permission, Role
from organizations.services import OrganizationService
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

_PDF = b"%PDF-1.4 minimal"
_PNG = b"\x89PNG\r\n\x1a\n" + b"P" * 50
_TXT = b"2026-08-23 INFO started\n"
_JPEG = b"\xff\xd8\xff\xe0" + b"J" * 50


def _auth_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


def _give_permission(user, organization, codename):
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


def _upload_url(org_id, incident_id):
    return f"/api/v1/organizations/{org_id}/incidents/{incident_id}/attachments/"


def _download_url(org_id, incident_id, att_id):
    return f"/api/v1/organizations/{org_id}/incidents/{incident_id}/attachments/{att_id}/download/"


def _delete_url(org_id, incident_id, att_id):
    return (
        f"/api/v1/organizations/{org_id}/incidents/{incident_id}/attachments/{att_id}/"
    )


class AttachmentListTest(TestCase):
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
            title="Inc",
            description="desc",
        )
        _give_permission(self.user, self.org, "incident.view")
        self.client = _auth_client(self.user)

    def test_list_empty(self):
        url = _upload_url(self.org.id, self.incident.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        results = data.get("results", data)
        self.assertEqual(len(results), 0)

    def test_list_returns_uploaded_attachments(self):
        f = SimpleUploadedFile("doc.pdf", _PDF, content_type="application/pdf")
        AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )
        url = _upload_url(self.org.id, self.incident.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        results = data.get("results", data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["original_filename"], "doc.pdf")

    def test_list_unauthenticated_denied(self):
        url = _upload_url(self.org.id, self.incident.id)
        response = APIClient().get(url)
        self.assertEqual(response.status_code, 401)

    def test_list_wrong_organization_404(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(
            user=other_user, name="Other Corp"
        )
        _give_permission(other_user, other_org, "incident.view")
        other_client = _auth_client(other_user)
        url = _upload_url(other_org.id, self.incident.id)
        response = other_client.get(url)
        # incident belongs to self.org, not other_org → 404
        self.assertEqual(response.status_code, 404)

    def test_list_invalid_incident_id_404(self):
        import uuid

        url = _upload_url(self.org.id, uuid.uuid4())
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)


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
            title="Inc",
            description="desc",
        )
        _give_permission(self.user, self.org, "incident.view")
        self.client = _auth_client(self.user)

    def _post(self, name, content, content_type):
        url = _upload_url(self.org.id, self.incident.id)
        f = SimpleUploadedFile(name, content, content_type=content_type)
        return self.client.post(url, {"file": f}, format="multipart")

    # ------------------------------------------------------------------
    # Success cases
    # ------------------------------------------------------------------

    def test_upload_pdf_success(self):
        response = self._post("report.pdf", _PDF, "application/pdf")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["original_filename"], "report.pdf")
        self.assertEqual(response.data["content_type"], "application/pdf")
        self.assertIn("download_url", response.data)
        self.assertIn("id", response.data)

    def test_upload_image_png_success(self):
        response = self._post("screenshot.png", _PNG, "image/png")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["content_type"], "image/png")

    def test_upload_image_jpeg_success(self):
        response = self._post("photo.jpeg", _JPEG, "image/jpeg")
        self.assertEqual(response.status_code, 201)

    def test_upload_log_txt_success(self):
        response = self._post("app.txt", _TXT, "text/plain")
        self.assertEqual(response.status_code, 201)

    def test_upload_log_log_success(self):
        response = self._post("app.log", _TXT, "text/plain")
        self.assertEqual(response.status_code, 201)

    # ------------------------------------------------------------------
    # Response structure
    # ------------------------------------------------------------------

    def test_upload_response_does_not_expose_storage_path(self):
        response = self._post("report.pdf", _PDF, "application/pdf")
        self.assertEqual(response.status_code, 201)
        # 'file' field (internal storage path) must not be in the response
        self.assertNotIn("file", response.data)
        self.assertNotIn("stored_path", response.data)

    def test_upload_response_does_not_expose_absolute_path(self):
        response = self._post("report.pdf", _PDF, "application/pdf")
        self.assertEqual(response.status_code, 201)
        download_url = response.data.get("download_url", "")
        # Must be a relative or absolute URL to our API endpoint, not a raw filesystem path
        self.assertNotIn("/media/", download_url)
        self.assertIn("/attachments/", download_url)
        self.assertIn("/download/", download_url)

    def test_upload_uploader_matches_authenticated_user(self):
        response = self._post("report.pdf", _PDF, "application/pdf")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["uploader"]["email"], self.user.email)

    def test_client_cannot_override_uploader(self):
        """Submitting an extra 'uploader' field in the form must be ignored."""
        url = _upload_url(self.org.id, self.incident.id)
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        response = self.client.post(
            url,
            {"file": f, "uploader": "hacker@evil.com"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["uploader"]["email"], self.user.email)

    def test_client_cannot_override_incident(self):
        """An 'incident' field in the form must be ignored."""
        import uuid

        url = _upload_url(self.org.id, self.incident.id)
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        fake_incident_id = str(uuid.uuid4())
        response = self.client.post(
            url,
            {"file": f, "incident": fake_incident_id},
            format="multipart",
        )
        # Must succeed and attach to the URL-derived incident, not the submitted one
        self.assertEqual(response.status_code, 201)
        self.assertEqual(str(response.data["incident"]), str(self.incident.id))

    # ------------------------------------------------------------------
    # Rejection cases
    # ------------------------------------------------------------------

    def test_unsupported_extension_rejected(self):
        response = self._post("data.csv", b"a,b,c", "text/csv")
        self.assertEqual(response.status_code, 400)

    def test_blocked_extension_exe_rejected(self):
        response = self._post("evil.exe", b"MZ\x90\x00", "application/octet-stream")
        self.assertEqual(response.status_code, 400)

    def test_blocked_extension_bat_rejected(self):
        response = self._post("evil.bat", b"@echo off", "application/octet-stream")
        self.assertEqual(response.status_code, 400)

    def test_blocked_extension_sh_rejected(self):
        response = self._post("evil.sh", b"#!/bin/bash\nrm -rf /", "text/plain")
        self.assertEqual(response.status_code, 400)

    def test_blocked_extension_py_rejected(self):
        response = self._post(
            "evil.py", b"import os;os.system('rm -rf /')", "text/plain"
        )
        self.assertEqual(response.status_code, 400)

    def test_mime_mismatch_rejected(self):
        # .pdf extension but image/jpeg MIME
        response = self._post("trick.pdf", _JPEG, "image/jpeg")
        self.assertEqual(response.status_code, 400)

    def test_oversized_file_rejected(self):
        from django.conf import settings

        big = b"X" * (settings.ATTACHMENT_MAX_FILE_SIZE_BYTES + 1)
        response = self._post("big.txt", big, "text/plain")
        self.assertEqual(response.status_code, 400)

    def test_empty_file_rejected(self):
        response = self._post("empty.pdf", b"", "application/pdf")
        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_upload_denied(self):
        url = _upload_url(self.org.id, self.incident.id)
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        response = APIClient().post(url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, 401)

    def test_non_member_upload_denied(self):
        outsider = User.objects.create_user(
            email="outsider@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(
            user=outsider, name="Evil Corp"
        )
        _give_permission(outsider, other_org, "incident.view")
        outsider_client = _auth_client(outsider)
        url = _upload_url(self.org.id, self.incident.id)
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        response = outsider_client.post(url, {"file": f}, format="multipart")
        # org not found for outsider → 404 or 403
        self.assertIn(response.status_code, [403, 404])

    def test_malformed_multipart_no_file_field(self):
        url = _upload_url(self.org.id, self.incident.id)
        response = self.client.post(url, {"not_file": "data"}, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_upload_invalid_incident_id_404(self):
        import uuid

        url = _upload_url(self.org.id, uuid.uuid4())
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        response = self.client.post(url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, 404)


class AttachmentDownloadTest(TestCase):
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
            title="Inc",
            description="desc",
        )
        _give_permission(self.user, self.org, "incident.view")
        self.client = _auth_client(self.user)
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        self.attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )

    def test_download_success_returns_200(self):
        url = _download_url(self.org.id, self.incident.id, self.attachment.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_download_content_disposition_attachment(self):
        url = _download_url(self.org.id, self.incident.id, self.attachment.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response.get("Content-Disposition", ""))

    def test_download_x_content_type_nosniff(self):
        url = _download_url(self.org.id, self.incident.id, self.attachment.id)
        response = self.client.get(url)
        self.assertEqual(response.get("X-Content-Type-Options"), "nosniff")

    def test_download_correct_content_type(self):
        url = _download_url(self.org.id, self.incident.id, self.attachment.id)
        response = self.client.get(url)
        self.assertEqual(response.get("Content-Type"), "application/pdf")

    def test_download_unauthenticated_denied(self):
        url = _download_url(self.org.id, self.incident.id, self.attachment.id)
        response = APIClient().get(url)
        self.assertEqual(response.status_code, 401)

    def test_download_invalid_attachment_id_404(self):
        import uuid

        url = _download_url(self.org.id, self.incident.id, uuid.uuid4())
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_download_wrong_org_404(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(
            user=other_user, name="Other Corp"
        )
        _give_permission(other_user, other_org, "incident.view")
        other_client = _auth_client(other_user)
        # Try to download using other_org's context — incident doesn't belong there
        url = _download_url(other_org.id, self.incident.id, self.attachment.id)
        response = other_client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_download_cross_tenant_attachment_id_404(self):
        """
        Even if attacker knows the attachment UUID, the incident scope
        prevents cross-tenant access.
        """
        attacker = User.objects.create_user(
            email="attacker@example.com", password="Password123!"
        )
        attacker_org = OrganizationService.create_organization(
            user=attacker, name="Attacker Corp"
        )
        attacker_incident = IncidentService.create_incident(
            organization=attacker_org,
            reporter_user=attacker,
            title="Attacker Inc",
            description="desc",
        )
        _give_permission(attacker, attacker_org, "incident.view")
        attacker_client = _auth_client(attacker)
        url = _download_url(attacker_org.id, attacker_incident.id, self.attachment.id)
        response = attacker_client.get(url)
        self.assertEqual(response.status_code, 404)


class AttachmentDeleteViewTest(TestCase):
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
            title="Inc",
            description="desc",
        )
        _give_permission(self.user, self.org, "incident.view")
        self.client = _auth_client(self.user)
        f = SimpleUploadedFile("report.pdf", _PDF, content_type="application/pdf")
        self.attachment = AttachmentService.upload_attachment(
            incident=self.incident, uploader=self.user, uploaded_file=f
        )

    def test_uploader_can_delete(self):
        url = _delete_url(self.org.id, self.incident.id, self.attachment.id)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Attachment.objects.filter(id=self.attachment.id).exists())

    def test_unrelated_member_cannot_delete(self):
        other = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _give_permission(other, self.org, "incident.view")
        other_client = _auth_client(other)
        url = _delete_url(self.org.id, self.incident.id, self.attachment.id)
        response = other_client.delete(url)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Attachment.objects.filter(id=self.attachment.id).exists())

    def test_unauthenticated_delete_denied(self):
        url = _delete_url(self.org.id, self.incident.id, self.attachment.id)
        response = APIClient().delete(url)
        self.assertEqual(response.status_code, 401)

    def test_delete_invalid_attachment_id_404(self):
        import uuid

        url = _delete_url(self.org.id, self.incident.id, uuid.uuid4())
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 404)

    def test_delete_cross_tenant_404(self):
        attacker = User.objects.create_user(
            email="attacker@example.com", password="Password123!"
        )
        attacker_org = OrganizationService.create_organization(
            user=attacker, name="Attacker Corp"
        )
        attacker_incident = IncidentService.create_incident(
            organization=attacker_org,
            reporter_user=attacker,
            title="Att Inc",
            description="desc",
        )
        _give_permission(attacker, attacker_org, "incident.view")
        attacker_client = _auth_client(attacker)
        url = _delete_url(attacker_org.id, attacker_incident.id, self.attachment.id)
        response = attacker_client.delete(url)
        self.assertEqual(response.status_code, 404)
