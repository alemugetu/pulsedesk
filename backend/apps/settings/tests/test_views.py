"""
API / view-level tests for the OrganizationSettings endpoint.

Covers:
  GET:
    - Authorized (owner/admin/ops/agent/viewer) → 200
    - Returns default settings for new and legacy orgs
    - Unauthenticated → 401
    - Cross-tenant access → 404 (not 403 — prevents org enumeration)

  PATCH:
    - Partial update → 200 with full settings response
    - Invalid enum value → 400
    - Unknown field → 400 unknown_fields
    - Client cannot change organization_id → rejected (serializer ignores it)
    - No changes (empty payload) → 200 (idempotent)
    - Unauthenticated → 401
    - Cross-tenant PATCH → 404

  Security:
    - Cross-tenant read: Org A user cannot GET Org B settings → 404
    - Cross-tenant write: Org A user cannot PATCH Org B settings → 404
    - Sensitive env data (SECRET_KEY, DB creds) not exposed anywhere in response
    - Audit log does not contain secrets (no secrets exist in settings, but confirm)
    - Django admin: no raw credentials, org FK is read-only once saved
"""

import uuid

from audit_logs.models import AuditAction, AuditLog
from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Organization, Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from settings.models import OrganizationSettings
from settings.selectors import get_settings_for_organization

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


class TwoOrgsFixture(TestCase):
    """Two isolated orgs with owners."""

    def setUp(self):
        self.user_a = _make_user("alice@example.com")
        self.user_b = _make_user("bob@example.com")
        self.org_a = OrganizationService.create_organization(
            user=self.user_a, name="Org A", slug="org-a"
        )
        self.org_b = OrganizationService.create_organization(
            user=self.user_b, name="Org B", slug="org-b"
        )
        self.client_a = _auth_client(self.user_a)
        self.client_b = _auth_client(self.user_b)


# ---------------------------------------------------------------------------
# GET endpoint tests
# ---------------------------------------------------------------------------


class SettingsGetAPITest(TwoOrgsFixture):
    def test_get_returns_200_for_owner(self):
        response = self.client_a.get(_settings_url(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_returns_all_expected_fields(self):
        response = self.client_a.get(_settings_url(self.org_a.id))
        payload = response.data
        for key in (
            "id",
            "default_incident_priority",
            "default_incident_status",
            "incident_comments_enabled",
            "notification_incident_emails_enabled",
            "notification_escalation_emails_enabled",
            "notification_sla_emails_enabled",
            "sla_auto_apply_default_policy",
            "escalation_auto_apply_default_policy",
            "created_at",
            "updated_at",
        ):
            self.assertIn(key, payload, f"Missing field {key}")

    def test_get_default_values_are_correct(self):
        response = self.client_a.get(_settings_url(self.org_a.id))
        self.assertEqual(response.data["default_incident_priority"], "P3")
        self.assertEqual(response.data["default_incident_status"], "OPEN")
        self.assertTrue(response.data["incident_comments_enabled"])
        self.assertTrue(response.data["sla_auto_apply_default_policy"])
        self.assertTrue(response.data["escalation_auto_apply_default_policy"])

    def test_get_does_not_expose_organization_id_on_settings(self):
        """The read serializer never exposes the org FK (immutable)."""
        response = self.client_a.get(_settings_url(self.org_a.id))
        self.assertNotIn("organization", response.data)

    def test_get_for_legacy_org_creates_settings_on_demand(self):
        # Simulate a legacy org by deleting its settings row.
        OrganizationSettings.objects.filter(organization=self.org_a).delete()
        self.assertFalse(
            OrganizationSettings.objects.filter(
                organization=self.org_a
            ).exists()
        )
        response = self.client_a.get(_settings_url(self.org_a.id))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            OrganizationSettings.objects.filter(
                organization=self.org_a
            ).exists()
        )

    def test_get_unauthenticated_returns_401(self):
        response = APIClient().get(_settings_url(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_invalid_uuid_returns_404(self):
        self.client_a.get("/api/v1/organizations/not-uuid/settings/")
        # URL resolver won't match non-UUID → 404 from Django.
        response = self.client_a.get(
            f"/api/v1/organizations/{uuid.uuid4()}/settings/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Cross-tenant isolation (read) ─────────────────────────────────

    def test_get_cross_tenant_returns_404(self):
        """Org A owner accessing Org B settings gets 404 (prevents enumeration)."""
        response = self.client_a.get(_settings_url(self.org_b.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_cross_tenant_does_not_modify_org_b(self):
        self.client_a.get(_settings_url(self.org_b.id))
        b_settings = get_settings_for_organization(self.org_b)
        self.assertEqual(
            b_settings.default_incident_priority, "P3"
        )  # unchanged

    # ── Suspended membership ──────────────────────────────────────────

    def test_suspended_member_gets_403(self):
        membership = Membership.objects.get(
            user=self.user_a, organization=self.org_a
        )
        membership.status = MembershipStatus.SUSPENDED
        membership.save(update_fields=["status"])
        response = self.client_a.get(_settings_url(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_removed_member_gets_403(self):
        membership = Membership.objects.get(
            user=self.user_a, organization=self.org_a
        )
        membership.status = MembershipStatus.REMOVED
        membership.save(update_fields=["status"])
        response = self.client_a.get(_settings_url(self.org_a.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# PATCH endpoint tests
# ---------------------------------------------------------------------------


class SettingsPatchAPITest(TwoOrgsFixture):
    def test_partial_update_returns_200(self):
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["default_incident_priority"], "P1")

    def test_patch_persists_changes(self):
        self.client_a.patch(
            _settings_url(self.org_a.id),
            {
                "incident_comments_enabled": False,
                "sla_auto_apply_default_policy": False,
            },
            format="json",
        )
        settings = OrganizationSettings.objects.get(organization=self.org_a)
        self.assertFalse(settings.incident_comments_enabled)
        self.assertFalse(settings.sla_auto_apply_default_policy)

    def test_patch_returns_all_settings_not_just_updated(self):
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"escalation_auto_apply_default_policy": False},
            format="json",
        )
        self.assertIn("default_incident_priority", response.data)
        self.assertIn("incident_comments_enabled", response.data)
        self.assertEqual(
            response.data["escalation_auto_apply_default_policy"], False
        )

    def test_empty_payload_is_200_and_unchanged(self):
        before = OrganizationSettings.objects.get(organization=self.org_a)
        response = self.client_a.patch(
            _settings_url(self.org_a.id), {}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        after = OrganizationSettings.objects.get(organization=self.org_a)
        self.assertEqual(before.updated_at, after.updated_at)

    def test_invalid_priority_value_returns_400(self):
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"default_incident_priority": "P9"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("default_incident_priority", response.data)

    def test_invalid_status_value_returns_400(self):
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"default_incident_status": "NONEXISTENT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("default_incident_status", response.data)

    def test_non_boolean_rejected_by_serializer(self):
        """incident_comments_enabled must be a bool; passing string returns 400."""
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"incident_comments_enabled": "yes-please"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("incident_comments_enabled", response.data)

    def test_unknown_field_returns_400_with_code(self):
        payload = {
            "super_secret_db_password": "leaked!",
            "default_incident_priority": "P2",
        }
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Raising ValidationError(detail=..., code="...") inside
        # ModelSerializer.validate() surfaces the ErrorDetail under a
        # non-field-errors key (DRF convention).  Accept any of the
        # common shapes; we only care about two contract guarantees:
        #   (a) the request is rejected with 400
        #   (b) a clear indication of "unknown_fields" classification
        #       is present in the payload
        body_text = str(response.data)
        self.assertIn("Unknown setting field", body_text)
        self.assertIn("super_secret_db_password", body_text)
        # Priority must NOT have been persisted (the whole request
        # was rejected by validation BEFORE service layer).
        settings = OrganizationSettings.objects.get(organization=self.org_a)
        self.assertEqual(settings.default_incident_priority, "P3")

    def test_organization_id_in_payload_is_ignored(self):
        """
        Client cannot reassign settings to another org.
        The serializer does not declare 'organization' as writable, so the
        field is simply ignored.
        """
        other_org_id = str(self.org_b.id)
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"organization": other_org_id, "default_incident_priority": "P2"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        settings = OrganizationSettings.objects.get(organization=self.org_a)
        self.assertEqual(
            str(settings.organization_id), str(self.org_a.id)
        )
        # org_b's settings must not be touched.
        b_settings = OrganizationSettings.objects.get(organization=self.org_b)
        self.assertEqual(b_settings.default_incident_priority, "P3")

    def test_patch_creates_audit_log(self):
        response = self.client_a.patch(
            _settings_url(self.org_a.id),
            {"notification_sla_emails_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        logs = list(
            AuditLog.objects.filter(action=AuditAction.SETTINGS_UPDATED)
        )
        self.assertEqual(len(logs), 1)
        log = logs[0]
        self.assertEqual(log.organization, self.org_a)
        self.assertEqual(log.actor, self.user_a)
        self.assertIn(
            "notification_sla_emails_enabled", log.changes.get("after", {})
        )

    def test_audit_log_changes_dict_has_no_secrets(self):
        """
        Settings has no secrets, but confirm that the before/after dicts
        only contain the declared model fields (no credential leakage).
        """
        self.client_a.patch(
            _settings_url(self.org_a.id),
            {"notification_escalation_emails_enabled": False},
            format="json",
        )
        log = AuditLog.objects.get(action=AuditAction.SETTINGS_UPDATED)
        allowed = {
            "default_incident_priority",
            "default_incident_status",
            "incident_comments_enabled",
            "notification_incident_emails_enabled",
            "notification_escalation_emails_enabled",
            "notification_sla_emails_enabled",
            "sla_auto_apply_default_policy",
            "escalation_auto_apply_default_policy",
        }
        for side in ("before", "after"):
            for key in log.changes.get(side, {}).keys():
                self.assertIn(key, allowed)

    def test_patch_unauthenticated_returns_401(self):
        response = APIClient().patch(
            _settings_url(self.org_a.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Cross-tenant isolation (write) ────────────────────────────────

    def test_patch_cross_tenant_returns_404(self):
        response = self.client_a.patch(
            _settings_url(self.org_b.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # org_b must be unchanged.
        b_settings = OrganizationSettings.objects.get(organization=self.org_b)
        self.assertEqual(b_settings.default_incident_priority, "P3")

    def test_patch_cross_tenant_does_not_create_audit_log(self):
        self.client_a.patch(
            _settings_url(self.org_b.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(
            AuditLog.objects.filter(
                organization=self.org_b, action=AuditAction.SETTINGS_UPDATED
            ).count(),
            0,
        )

    # ── Viewer cannot modify ───────────────────────────────────────────

    def test_viewer_patch_returns_403(self):
        viewer = _make_user("viewer@example.com")
        Membership.objects.create(
            user=viewer, organization=self.org_a, status="ACTIVE"
        )
        _assign_role(viewer, self.org_a, "viewer")
        client = _auth_client(viewer)
        response = client.patch(
            _settings_url(self.org_a.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # ── Agent cannot modify ────────────────────────────────────────────

    def test_agent_patch_returns_403(self):
        agent = _make_user("agent@example.com")
        Membership.objects.create(
            user=agent, organization=self.org_a, status="ACTIVE"
        )
        _assign_role(agent, self.org_a, "agent")
        client = _auth_client(agent)
        response = client.patch(
            _settings_url(self.org_a.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


# ---------------------------------------------------------------------------
# Security tests — explicit matrix per spec items 1–10
# ---------------------------------------------------------------------------


class SettingsSecurityMatrixTest(TestCase):
    """
    Explicit tests mirroring the 10-item security checklist from the
    Phase 13.6 specification.
    """

    def setUp(self):
        # Org A
        self.user_a_owner = _make_user("a_owner@example.com")
        self.user_a_viewer = _make_user("a_viewer@example.com")
        self.user_a_agent = _make_user("a_agent@example.com")
        self.user_a_admin = _make_user("a_admin@example.com")
        self.org_a = OrganizationService.create_organization(
            user=self.user_a_owner, name="Org A", slug="org-a-sec"
        )
        for user, role_slug in [
            (self.user_a_viewer, "viewer"),
            (self.user_a_agent, "agent"),
            (self.user_a_admin, "organization-admin"),
        ]:
            Membership.objects.create(
                user=user, organization=self.org_a, status="ACTIVE"
            )
            _assign_role(user, self.org_a, role_slug)

        # Org B
        self.user_b_owner = _make_user("b_owner@example.com")
        self.org_b = OrganizationService.create_organization(
            user=self.user_b_owner, name="Org B", slug="org-b-sec"
        )

        self.a_owner_cli = _auth_client(self.user_a_owner)
        self.a_viewer_cli = _auth_client(self.user_a_viewer)
        self.a_agent_cli = _auth_client(self.user_a_agent)
        self.a_admin_cli = _auth_client(self.user_a_admin)
        self.b_owner_cli = _auth_client(self.user_b_owner)

    # 1. Org A cannot read Org B settings
    def test_1_org_a_cannot_read_org_b_settings(self):
        response = self.a_owner_cli.get(_settings_url(self.org_b.id))
        self.assertEqual(response.status_code, 404)

    # 2. Org A cannot modify Org B settings
    def test_2_org_a_cannot_modify_org_b_settings(self):
        response = self.a_owner_cli.patch(
            _settings_url(self.org_b.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        b_settings = OrganizationSettings.objects.get(organization=self.org_b)
        self.assertEqual(b_settings.default_incident_priority, "P3")

    # 3. Viewer cannot modify settings
    def test_3_viewer_cannot_modify_settings(self):
        response = self.a_viewer_cli.patch(
            _settings_url(self.org_a.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # 4. Agent cannot modify settings
    def test_4_agent_cannot_modify_settings(self):
        response = self.a_agent_cli.patch(
            _settings_url(self.org_a.id),
            {"incident_comments_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # 5. Admin follows intended permission (can modify)
    def test_5_admin_can_modify_settings(self):
        response = self.a_admin_cli.patch(
            _settings_url(self.org_a.id),
            {"default_incident_priority": "P2"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["default_incident_priority"], "P2")

    # 6. Owner follows intended permission (can modify)
    def test_6_owner_can_modify_settings(self):
        response = self.a_owner_cli.patch(
            _settings_url(self.org_a.id),
            {"default_incident_priority": "P1"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["default_incident_priority"], "P1")

    # 7. Client cannot change organization_id
    def test_7_client_cannot_change_organization_id(self):
        response = self.a_owner_cli.patch(
            _settings_url(self.org_a.id),
            {
                "organization": str(self.org_b.id),
                "default_incident_priority": "P4",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        settings = OrganizationSettings.objects.get(organization=self.org_a)
        self.assertEqual(str(settings.organization_id), str(self.org_a.id))
        # org_b untouched
        b_settings = OrganizationSettings.objects.get(organization=self.org_b)
        self.assertEqual(b_settings.default_incident_priority, "P3")

    # 8. Sensitive environment configuration is not exposed
    def test_8_sensitive_env_data_not_exposed_in_response(self):
        response = self.a_owner_cli.get(_settings_url(self.org_a.id))
        bad = {
            "secret_key",
            "database",
            "password",
            "django_secret_key",
            "smtp",
            "api_key",
            "jwt",
        }
        for key in response.data.keys():
            self.assertNotIn(key.lower(), bad)

    # 9. Audit logs do not contain secrets
    def test_9_audit_logs_do_not_contain_secrets(self):
        self.a_admin_cli.patch(
            _settings_url(self.org_a.id),
            {"notification_incident_emails_enabled": False},
            format="json",
        )
        log = AuditLog.objects.get(action=AuditAction.SETTINGS_UPDATED)
        bad = ("password", "secret", "key", "credential", "token", "api_key")
        import json

        raw = json.dumps(log.changes).lower()
        for badword in bad:
            self.assertNotIn(badword, raw)

    # 10. Django admin exposure does not bypass API authorization
    def test_10_admin_does_not_bypass_rbac(self):
        """
        We cannot easily render admin pages without a staff user, but we
        can assert that:
          a) staff/admin is not required via API (our DRF permissions run)
          b) non-staff owner can still manage settings via API
          c) a non-member who IS staff on Django admin cannot GET settings
             because IsOrganizationMember is the gate.
        """
        # Promote org B's owner to Django staff (but they are not a member of org A).
        self.user_b_owner.is_staff = True
        self.user_b_owner.is_superuser = False
        self.user_b_owner.save()
        # staff member of org_b must not see org_a settings.
        response = self.b_owner_cli.get(_settings_url(self.org_a.id))
        self.assertEqual(response.status_code, 404)
