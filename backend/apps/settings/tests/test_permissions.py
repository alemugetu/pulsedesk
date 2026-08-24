"""
RBAC permission tests for organization settings.

Verifies the exact per-role access matrix:
  Role              | settings.view | settings.manage
  ------------------+---------------+-----------------
  Organization Owner|       ✓       |       ✓
  Organization Admin|       ✓       |       ✓
  Operations Manager|       ✓       |       ✗
  Agent             |       ✓       |       ✗
  Viewer            |       ✓       |       ✗
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Membership, Role
from organizations.services import OrganizationService
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

ROLE_SLUGS = [
    "organization-owner",
    "organization-admin",
    "operations-manager",
    "agent",
    "viewer",
]

VIEW_ALLOWED = {
    "organization-owner",
    "organization-admin",
    "operations-manager",
    "agent",
    "viewer",
}
MANAGE_ALLOWED = {
    "organization-owner",
    "organization-admin",
}


def _make_user(email):
    return User.objects.create_user(email=email, password="Password123!")


def _auth_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


def _assign_role(user, org, slug):
    role = Role.objects.get(organization=org, slug=slug)
    Membership.objects.filter(user=user, organization=org).update(role=role)


def _settings_url(org_id):
    return f"/api/v1/organizations/{org_id}/settings/"


class SettingsRBACMatrixTest(TestCase):
    """Tests the permission matrix for every system role."""

    def setUp(self):
        self.org_owner = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.org_owner, name="Acme Corp"
        )
        self.users_by_role = {}
        for slug in ROLE_SLUGS:
            user = _make_user(f"{slug.replace('-', '_')}+1@example.com")
            Membership.objects.create(
                user=user,
                organization=self.org,
                status="ACTIVE",
            )
            _assign_role(user, self.org, slug)
            self.users_by_role[slug] = user

    # ── settings.view ──────────────────────────────────────────────────

    def test_every_role_can_view_settings(self):
        for slug in ROLE_SLUGS:
            with self.subTest(role=slug):
                client = _auth_client(self.users_by_role[slug])
                response = client.get(_settings_url(self.org.id))
                expected = 200 if slug in VIEW_ALLOWED else 403
                self.assertEqual(
                    response.status_code,
                    expected,
                    f"Role {slug}: expected {expected}, got {response.status_code}",
                )
                if expected == 200:
                    self.assertIn("default_incident_priority", response.data)

    # ── settings.manage ────────────────────────────────────────────────

    def test_only_owner_and_admin_can_manage_settings(self):
        payload = {"default_incident_priority": "P1"}
        for slug in ROLE_SLUGS:
            with self.subTest(role=slug):
                client = _auth_client(self.users_by_role[slug])
                response = client.patch(
                    _settings_url(self.org.id), payload, format="json"
                )
                expected = 200 if slug in MANAGE_ALLOWED else 403
                self.assertEqual(
                    response.status_code,
                    expected,
                    f"Role {slug}: expected {expected}, got {response.status_code}",
                )

    # ── Viewer cannot modify ───────────────────────────────────────────

    def test_viewer_cannot_modify_settings(self):
        viewer_client = _auth_client(self.users_by_role["viewer"])
        response = viewer_client.patch(
            _settings_url(self.org.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # ── Agent cannot modify ────────────────────────────────────────────

    def test_agent_cannot_modify_settings(self):
        agent_client = _auth_client(self.users_by_role["agent"])
        response = agent_client.patch(
            _settings_url(self.org.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # ── Ops Manager cannot modify ──────────────────────────────────────

    def test_operations_manager_cannot_modify_settings(self):
        ops_client = _auth_client(self.users_by_role["operations-manager"])
        response = ops_client.patch(
            _settings_url(self.org.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # ── Owner can modify ───────────────────────────────────────────────

    def test_owner_can_modify_settings(self):
        owner_client = _auth_client(self.users_by_role["organization-owner"])
        response = owner_client.patch(
            _settings_url(self.org.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["default_incident_priority"], "P1")

    # ── Admin can modify ───────────────────────────────────────────────

    def test_admin_can_modify_settings(self):
        admin_client = _auth_client(self.users_by_role["organization-admin"])
        response = admin_client.patch(
            _settings_url(self.org.id),
            {"default_incident_priority": "P2"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["default_incident_priority"], "P2")
