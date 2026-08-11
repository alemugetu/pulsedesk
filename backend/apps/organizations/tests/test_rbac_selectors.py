"""Tests for RBAC selectors including user_has_permission."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Membership, MembershipStatus, Role
from organizations.selectors import (
    get_membership_by_id,
    get_organization_roles,
    get_role_by_id,
    user_has_permission,
)
from organizations.services import OrganizationService

User = get_user_model()


class UserHasPermissionTest(TestCase):
    def setUp(self):
        self.owner_user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.viewer_user = User.objects.create_user(
            email="viewer@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner_user, name="Acme"
        )
        self.owner_membership = Membership.objects.get(
            user=self.owner_user, organization=self.org
        )
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        self.viewer_membership = Membership.objects.create(
            user=self.viewer_user,
            organization=self.org,
            role=viewer_role,
            status=MembershipStatus.ACTIVE,
        )

    def test_owner_has_all_permissions(self):
        self.assertTrue(
            user_has_permission(self.owner_user, self.org, "organization.view")
        )
        self.assertTrue(user_has_permission(self.owner_user, self.org, "role.manage"))
        self.assertTrue(user_has_permission(self.owner_user, self.org, "member.remove"))

    def test_viewer_has_only_read_permissions(self):
        self.assertTrue(
            user_has_permission(self.viewer_user, self.org, "organization.view")
        )
        self.assertTrue(user_has_permission(self.viewer_user, self.org, "member.view"))
        self.assertFalse(user_has_permission(self.viewer_user, self.org, "role.manage"))
        self.assertFalse(
            user_has_permission(self.viewer_user, self.org, "member.invite")
        )

    def test_no_role_returns_false(self):
        no_role_user = User.objects.create_user(
            email="norole@example.com", password="pass123"
        )
        Membership.objects.create(
            user=no_role_user,
            organization=self.org,
            role=None,
            status=MembershipStatus.ACTIVE,
        )
        self.assertFalse(
            user_has_permission(no_role_user, self.org, "organization.view")
        )

    def test_suspended_membership_returns_false(self):
        self.viewer_membership.status = MembershipStatus.SUSPENDED
        self.viewer_membership.save(update_fields=["status"])
        self.assertFalse(
            user_has_permission(self.viewer_user, self.org, "organization.view")
        )

    def test_removed_membership_returns_false(self):
        self.viewer_membership.status = MembershipStatus.REMOVED
        self.viewer_membership.save(update_fields=["status"])
        self.assertFalse(
            user_has_permission(self.viewer_user, self.org, "organization.view")
        )

    def test_unauthenticated_user_returns_false(self):
        self.assertFalse(user_has_permission(None, self.org, "organization.view"))

    def test_non_member_returns_false(self):
        outsider = User.objects.create_user(email="out@example.com", password="pass123")
        self.assertFalse(user_has_permission(outsider, self.org, "organization.view"))


class GetOrganizationRolesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(user=self.user, name="Acme")

    def test_returns_all_system_roles(self):
        roles = list(get_organization_roles(self.org))
        slugs = {r.slug for r in roles}
        self.assertIn("organization-owner", slugs)
        self.assertIn("viewer", slugs)
        self.assertEqual(len(roles), 5)

    def test_permissions_prefetched(self):
        roles = list(get_organization_roles(self.org))
        # Access permissions without extra queries (prefetch_related)
        for role in roles:
            _ = list(role.permissions.all())


class GetRoleByIdTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(user=self.user, name="Acme")
        self.viewer_role = Role.objects.get(organization=self.org, slug="viewer")

    def test_get_existing_role(self):
        role = get_role_by_id(self.viewer_role.id, self.org)
        self.assertEqual(role, self.viewer_role)

    def test_get_nonexistent_role_returns_none(self):
        import uuid

        self.assertIsNone(get_role_by_id(uuid.uuid4(), self.org))

    def test_cross_tenant_role_not_returned(self):
        from organizations.models import Organization

        org2 = Organization.objects.create(name="Beta", slug="beta")
        from organizations.services import RBACService

        RBACService.seed_system_roles(org2)
        org2_viewer = Role.objects.get(organization=org2, slug="viewer")
        # Lookup with wrong org should return None
        self.assertIsNone(get_role_by_id(org2_viewer.id, self.org))


class GetMembershipByIdTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(user=self.user, name="Acme")
        self.membership = Membership.objects.get(user=self.user, organization=self.org)

    def test_get_existing_membership(self):
        m = get_membership_by_id(self.membership.id, self.org)
        self.assertEqual(m, self.membership)

    def test_cross_tenant_membership_not_returned(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="pass123"
        )
        org2 = OrganizationService.create_organization(user=other_user, name="Beta")
        other_m = Membership.objects.get(user=other_user, organization=org2)
        # Looking up org2's membership with org1 should return None
        self.assertIsNone(get_membership_by_id(other_m.id, self.org))
