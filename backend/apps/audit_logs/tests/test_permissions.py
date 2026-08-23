"""
Tests for AuditLog permission classes.

Covers:
- Unauthenticated user is denied (CanViewAuditLogs)
- No organization context on request is denied
- Member with audit_log.view permission is allowed
- Member without audit_log.view permission is denied
- RBAC role matrix: Owner has audit_log.view
- RBAC role matrix: Admin has audit_log.view
- RBAC role matrix: Operations Manager has audit_log.view
- RBAC role matrix: Agent does NOT have audit_log.view
- RBAC role matrix: Viewer does NOT have audit_log.view
"""

from audit_logs.permissions import CanViewAuditLogs
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from organizations.models import Membership, MembershipStatus, Role
from organizations.selectors import user_has_permission
from organizations.services import OrganizationService

User = get_user_model()


def _make_user(email):
    return User.objects.create_user(email=email, password="Password123!")


def _make_request(user, organization=None):
    rf = RequestFactory()
    request = rf.get("/")
    request.user = user
    if organization is not None:
        request.organization = organization
    return request


def _assign_system_role(user, org, slug):
    role = Role.objects.get(organization=org, slug=slug)
    Membership.objects.filter(user=user, organization=org).update(role=role)


class CanViewAuditLogsPermissionTest(TestCase):
    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )

    def test_unauthenticated_denied(self):
        from django.contrib.auth.models import AnonymousUser

        request = _make_request(AnonymousUser(), self.org)
        perm = CanViewAuditLogs()
        self.assertFalse(perm.has_permission(request, None))

    def test_no_organization_context_denied(self):
        request = _make_request(self.user)
        perm = CanViewAuditLogs()
        self.assertFalse(perm.has_permission(request, None))

    def test_member_with_audit_log_view_allowed(self):
        # The owner (setUp) has all permissions including audit_log.view
        request = _make_request(self.user, self.org)
        perm = CanViewAuditLogs()
        self.assertTrue(perm.has_permission(request, None))

    def test_member_without_audit_log_view_denied(self):
        agent = _make_user("agent@example.com")
        Membership.objects.create(
            user=agent, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _assign_system_role(agent, self.org, "agent")
        request = _make_request(agent, self.org)
        perm = CanViewAuditLogs()
        self.assertFalse(perm.has_permission(request, None))


class AuditLogRBACMatrixTest(TestCase):
    """Verify the audit_log.view permission assignment across system roles."""

    def setUp(self):
        self.owner = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )

    def _make_member_with_role(self, email, role_slug):
        user = _make_user(email)
        Membership.objects.create(
            user=user, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _assign_system_role(user, self.org, role_slug)
        return user

    def test_owner_has_audit_log_view(self):
        self.assertTrue(user_has_permission(self.owner, self.org, "audit_log.view"))

    def test_admin_has_audit_log_view(self):
        admin = self._make_member_with_role("admin@example.com", "organization-admin")
        self.assertTrue(user_has_permission(admin, self.org, "audit_log.view"))

    def test_operations_manager_has_audit_log_view(self):
        ops = self._make_member_with_role("ops@example.com", "operations-manager")
        self.assertTrue(user_has_permission(ops, self.org, "audit_log.view"))

    def test_agent_does_not_have_audit_log_view(self):
        agent = self._make_member_with_role("agent@example.com", "agent")
        self.assertFalse(user_has_permission(agent, self.org, "audit_log.view"))

    def test_viewer_does_not_have_audit_log_view(self):
        viewer = self._make_member_with_role("viewer@example.com", "viewer")
        self.assertFalse(user_has_permission(viewer, self.org, "audit_log.view"))
