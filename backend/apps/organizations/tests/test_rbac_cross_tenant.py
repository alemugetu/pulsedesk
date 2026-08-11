"""
Cross-tenant RBAC isolation tests.

Verifies that:
- Permissions granted in Org A do not apply to Org B.
- A role from Org A cannot be assigned to a membership in Org B.
- user_has_permission is always org-scoped.
- A user with Admin in Org A has no elevated access in Org B.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Membership, MembershipStatus, Role
from organizations.selectors import user_has_permission
from organizations.services import (
    OrganizationAccessValidationError,
    OrganizationService,
    RBACService,
)

User = get_user_model()


class CrossTenantPermissionTest(TestCase):
    def setUp(self):
        # User A is an admin in Org A and a viewer in Org B.
        self.user_a = User.objects.create_user(
            email="usera@example.com", password="pass123"
        )
        self.user_b = User.objects.create_user(
            email="userb@example.com", password="pass123"
        )

        self.org_a = OrganizationService.create_organization(
            user=self.user_a, name="Org A"
        )
        self.org_b = OrganizationService.create_organization(
            user=self.user_b, name="Org B"
        )

        # Give user_a a viewer membership in org_b.
        viewer_role_b = Role.objects.get(organization=self.org_b, slug="viewer")
        self.membership_a_in_b = Membership.objects.create(
            user=self.user_a,
            organization=self.org_b,
            role=viewer_role_b,
            status=MembershipStatus.ACTIVE,
        )

    def test_user_a_owner_in_org_a(self):
        self.assertTrue(user_has_permission(self.user_a, self.org_a, "role.manage"))

    def test_user_a_viewer_in_org_b(self):
        self.assertFalse(user_has_permission(self.user_a, self.org_b, "role.manage"))
        self.assertTrue(
            user_has_permission(self.user_a, self.org_b, "organization.view")
        )

    def test_user_a_admin_permission_does_not_leak_to_org_b(self):
        """Even though user_a is owner in org_a, org_b should be restricted."""
        self.assertFalse(user_has_permission(self.user_a, self.org_b, "member.invite"))
        self.assertFalse(user_has_permission(self.user_a, self.org_b, "member.remove"))

    def test_user_b_owner_in_org_b(self):
        self.assertTrue(user_has_permission(self.user_b, self.org_b, "role.manage"))

    def test_user_b_has_no_access_to_org_a(self):
        self.assertFalse(
            user_has_permission(self.user_b, self.org_a, "organization.view")
        )

    def test_role_from_org_a_cannot_be_assigned_to_org_b_membership(self):
        """
        Attempting to assign a role from org_a to a membership in org_b must fail.
        """
        owner_m_a = Membership.objects.get(user=self.user_a, organization=self.org_a)
        owner_role_a = Role.objects.get(
            organization=self.org_a, slug="organization-owner"
        )
        with self.assertRaises(OrganizationAccessValidationError) as ctx:
            RBACService.assign_role_to_membership(
                membership=self.membership_a_in_b,
                role=owner_role_a,  # role belongs to org_a, not org_b!
                actor_membership=owner_m_a,  # actor also from wrong org
            )
        # Should be permission_denied (actor not in org_b) or cross_tenant_role.
        self.assertIn(
            ctx.exception.code,
            {"permission_denied", "cross_tenant_role"},
        )

    def test_viewer_role_in_org_a_cannot_grant_org_b_access(self):
        """Confirming viewer in org_b cannot call org_a-scoped operations."""
        # user_a is owner in org_a but viewer in org_b
        # Checking org_b with org_a-level privilege expectation must return False
        self.assertFalse(user_has_permission(self.user_a, self.org_b, "role.assign"))


class CrossTenantRoleGetTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="u@example.com", password="pass123")
        self.org_a = OrganizationService.create_organization(
            user=self.user, name="Alpha"
        )
        self.other_user = User.objects.create_user(
            email="o@example.com", password="pass123"
        )
        self.org_b = OrganizationService.create_organization(
            user=self.other_user, name="Beta"
        )

    def test_get_role_by_id_scoped_to_org(self):
        from organizations.selectors import get_role_by_id

        viewer_a = Role.objects.get(organization=self.org_a, slug="viewer")
        viewer_b = Role.objects.get(organization=self.org_b, slug="viewer")

        # Looking up org_b's viewer with org_a context returns None
        self.assertIsNone(get_role_by_id(viewer_b.id, self.org_a))
        # Looking up org_a's viewer with org_a context returns correctly
        self.assertEqual(get_role_by_id(viewer_a.id, self.org_a), viewer_a)
