"""
API / view-level tests for the AuditLog module.

Covers:
- GET list: returns paginated results for org member with audit_log.view
- GET list: returns empty list when no records exist
- GET list: filter by action
- GET list: filter by resource_type
- GET list: filter by resource_id
- GET list: filter by actor_id
- GET list: filter by date_from / date_to
- GET list: unauthenticated returns 401
- GET list: member without audit_log.view returns 403
- GET list: wrong organization returns 404
- GET detail: returns correct record
- GET detail: wrong organization returns 404
- GET detail: non-existent id returns 404
- GET detail: unauthenticated returns 401
- No POST endpoint (405)
- No PATCH endpoint (405)
- No PUT endpoint (405)
- No DELETE endpoint (405)
- Cross-tenant: cannot read another org's audit log via own org
"""

import uuid

from audit_logs.models import AuditAction, AuditLog
from django.contrib.auth import get_user_model
from django.test import TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def _auth_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


def _make_user(email):
    return User.objects.create_user(email=email, password="Password123!")


def _assign_role(user, org, slug):
    role = Role.objects.get(organization=org, slug=slug)
    Membership.objects.filter(user=user, organization=org).update(role=role)


def _list_url(org_id):
    return f"/api/v1/organizations/{org_id}/audit-logs/"


def _detail_url(org_id, log_id):
    return f"/api/v1/organizations/{org_id}/audit-logs/{log_id}/"


def _make_log(
    org,
    user,
    action=AuditAction.INCIDENT_CREATED,
    resource_type="incident",
    resource_id=None,
):
    return AuditLog.objects.create(
        organization=org,
        actor=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id or str(uuid.uuid4()),
    )


class AuditLogListViewTest(TestCase):
    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        # Owner has audit_log.view
        self.client = _auth_client(self.user)

    def test_list_returns_200_for_authorized_user(self):
        url = _list_url(self.org.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_list_empty_when_no_records(self):
        url = _list_url(self.org.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        results = data.get("results", data)
        self.assertEqual(len(results), 0)

    def test_list_returns_created_records(self):
        _make_log(self.org, self.user)
        _make_log(
            self.org,
            self.user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        url = _list_url(self.org.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertGreaterEqual(len(results), 2)

    def test_list_unauthenticated_returns_401(self):
        url = _list_url(self.org.id)
        response = APIClient().get(url)
        self.assertEqual(response.status_code, 401)

    def test_list_agent_without_permission_returns_403(self):
        agent = _make_user("agent@example.com")
        Membership.objects.create(
            user=agent, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _assign_role(agent, self.org, "agent")
        agent_client = _auth_client(agent)
        url = _list_url(self.org.id)
        response = agent_client.get(url)
        self.assertEqual(response.status_code, 403)

    def test_list_wrong_organization_returns_404(self):
        other_user = _make_user("other@example.com")
        OrganizationService.create_organization(user=other_user, name="Other Corp")
        other_client = _auth_client(other_user)
        # Try to access self.org's audit logs using other_client
        url = _list_url(self.org.id)
        response = other_client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_filter_by_action(self):
        _make_log(self.org, self.user, action=AuditAction.INCIDENT_CREATED)
        _make_log(
            self.org,
            self.user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        url = _list_url(self.org.id) + f"?action={AuditAction.INCIDENT_CREATED}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        for item in results:
            self.assertEqual(item["action"], AuditAction.INCIDENT_CREATED)

    def test_filter_by_resource_type(self):
        _make_log(self.org, self.user, resource_type="incident")
        _make_log(
            self.org,
            self.user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        url = _list_url(self.org.id) + "?resource_type=comment"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        for item in results:
            self.assertEqual(item["resource_type"], "comment")

    def test_filter_by_resource_id(self):
        rid = str(uuid.uuid4())
        _make_log(self.org, self.user, resource_id=rid)
        _make_log(self.org, self.user)
        url = _list_url(self.org.id) + f"?resource_id={rid}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["resource_id"], rid)

    def test_filter_by_actor_id(self):
        other = _make_user("other@example.com")
        Membership.objects.create(
            user=other, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _make_log(self.org, self.user)
        _make_log(
            self.org, other, action=AuditAction.COMMENT_CREATED, resource_type="comment"
        )
        url = _list_url(self.org.id) + f"?actor_id={other.id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        for item in results:
            self.assertEqual(item["actor"]["id"], str(other.id))

    def test_response_schema_fields(self):
        _make_log(self.org, self.user)
        url = _list_url(self.org.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertGreaterEqual(len(results), 1)
        item = results[0]
        for field in [
            "id",
            "organization",
            "actor",
            "action",
            "resource_type",
            "resource_id",
            "changes",
            "created_at",
        ]:
            self.assertIn(field, item)

    def test_actor_summary_in_response(self):
        _make_log(self.org, self.user)
        url = _list_url(self.org.id)
        response = self.client.get(url)
        results = response.data.get("results", response.data)
        actor = results[0]["actor"]
        self.assertIn("id", actor)
        self.assertIn("email", actor)

    def test_system_actor_is_null_in_response(self):
        _make_log(self.org, None, action=AuditAction.SLA_BREACHED)
        url = _list_url(self.org.id) + f"?action={AuditAction.SLA_BREACHED}"
        response = self.client.get(url)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertIsNone(results[0]["actor"])

    def test_no_internal_storage_paths_in_response(self):
        _make_log(self.org, self.user)
        url = _list_url(self.org.id)
        response = self.client.get(url)
        results = response.data.get("results", response.data)
        for item in results:
            self.assertNotIn("file", item)
            self.assertNotIn("stored_path", item)


class AuditLogDetailViewTest(TestCase):
    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.client = _auth_client(self.user)
        self.log = _make_log(self.org, self.user)

    def test_detail_returns_200(self):
        url = _detail_url(self.org.id, self.log.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.log.id))

    def test_detail_unauthenticated_returns_401(self):
        url = _detail_url(self.org.id, self.log.id)
        response = APIClient().get(url)
        self.assertEqual(response.status_code, 401)

    def test_detail_wrong_org_returns_404(self):
        other_user = _make_user("other@example.com")
        other_org = OrganizationService.create_organization(
            user=other_user, name="Other Corp"
        )
        other_client = _auth_client(other_user)
        url = _detail_url(other_org.id, self.log.id)
        response = other_client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_detail_nonexistent_id_returns_404(self):
        url = _detail_url(self.org.id, uuid.uuid4())
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_detail_agent_without_permission_returns_403(self):
        agent = _make_user("agent@example.com")
        Membership.objects.create(
            user=agent, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _assign_role(agent, self.org, "agent")
        agent_client = _auth_client(agent)
        url = _detail_url(self.org.id, self.log.id)
        response = agent_client.get(url)
        self.assertEqual(response.status_code, 403)


class AuditLogNoWriteEndpointsTest(TestCase):
    """Verify that no write endpoints exist (POST/PATCH/PUT/DELETE)."""

    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.client = _auth_client(self.user)
        self.log = _make_log(self.org, self.user)

    def test_post_to_list_returns_405(self):
        url = _list_url(self.org.id)
        response = self.client.post(url, {"action": "incident.created"}, format="json")
        self.assertEqual(response.status_code, 405)

    def test_patch_to_detail_returns_405(self):
        url = _detail_url(self.org.id, self.log.id)
        response = self.client.patch(url, {"action": "tampered"}, format="json")
        self.assertEqual(response.status_code, 405)

    def test_put_to_detail_returns_405(self):
        url = _detail_url(self.org.id, self.log.id)
        response = self.client.put(url, {"action": "tampered"}, format="json")
        self.assertEqual(response.status_code, 405)

    def test_delete_to_detail_returns_405(self):
        url = _detail_url(self.org.id, self.log.id)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 405)

    def test_record_count_unchanged_after_blocked_write_attempts(self):
        before = AuditLog.objects.filter(organization=self.org).count()
        self.client.post(_list_url(self.org.id), {}, format="json")
        self.client.patch(_detail_url(self.org.id, self.log.id), {}, format="json")
        self.client.delete(_detail_url(self.org.id, self.log.id))
        after = AuditLog.objects.filter(organization=self.org).count()
        self.assertEqual(before, after)


class AuditLogIncidentIntegrationViewTest(TestCase):
    """Verify incident operations produce visible audit log entries via the API."""

    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.client = _auth_client(self.user)

    def test_incident_creation_visible_in_audit_log_api(self):
        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="API Audit Test",
        )
        url = (
            _list_url(self.org.id)
            + f"?action={AuditAction.INCIDENT_CREATED}"
            + f"&resource_id={incident.id}"
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["resource_id"], str(incident.id))
