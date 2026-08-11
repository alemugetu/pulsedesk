"""Tests for RBACService and OrganizationService (with RBAC integration)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    Permission,
    Role,
)
from organizations.services import (
    OrganizationAccessValidationError,
    OrganizationService,
    RBACService,
)

User = get_user_model()


class SeedPermissionsTest(TestCase):
    def test_seed_permissions_idempotent(self):
        RBACService.seed_permissions()
        count_first = Permission.objects.count()
        RBACService.seed_permissions()
        count_second = Permission.objects.count()
        self.assertEqual(count_first, count_second)
        self.assertGreater(count_first, 0)

    def test_all_expected_codenames_exist(self):
        RBACService.seed_permissions()
        expected = {
            "organization.view",
            "organization.update",
            "member.view",
            "member.invite",
            "member.remove",
            "member.suspend",
            "role.view",
            "role.manage",
            "role.assign",
        }
        existing = set(Permission.objects.values_list("codename", flat=True))
        self.assertTrue(expected.issubset(existing))


class SeedSystemRolesTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Acme", slug="acme")

    def test_seed_system_roles_creates_five_roles(self):
        RBACService.seed_system_roles(self.org)
        self.assertEqual(
            Role.objects.filter(organization=self.org, is_system_role=True).count(), 5
        )

    def test_seed_system_roles_idempotent(self):
        RBACService.seed_system_roles(self.org)
        RBACService.seed_system_roles(self.org)
        self.assertEqual(Role.objects.filter(organization=self.org).count(), 5)

    def test_owner_role_has_all_permissions(self):
        RBACService.seed_system_roles(self.org)
        owner_role = Role.objects.get(organization=self.org, slug="organization-owner")
        perm_codes = set(owner_role.permissions.values_list("codename", flat=True))
        self.assertIn("organization.view", perm_codes)
        self.assertIn("role.manage", perm_codes)
        self.assertIn("member.remove", perm_codes)

    def test_viewer_role_has_only_read_permissions(self):
        RBACService.seed_system_roles(self.org)
        viewer = Role.objects.get(organization=self.org, slug="viewer")
        perm_codes = set(viewer.permissions.values_list("codename", flat=True))
        self.assertIn("organization.view", perm_codes)
        self.assertNotIn("role.manage", perm_codes)
        self.assertNotIn("member.invite", perm_codes)

    def test_admin_cannot_modify_own_org(self):
        """Admin has organization.update but not delete-level ops."""
        RBACService.seed_system_roles(self.org)
        admin = Role.objects.get(organization=self.org, slug="organization-admin")
        perm_codes = set(admin.permissions.values_list("codename", flat=True))
        self.assertIn("organization.update", perm_codes)
        self.assertIn("role.manage", perm_codes)


class CreateOrganizationWithRBACTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="founder@example.com", password="pass123"
        )

    def test_create_organization_seeds_roles(self):
        org = OrganizationService.create_organization(user=self.user, name="Acme")
        self.assertEqual(
            Role.objects.filter(organization=org, is_system_role=True).count(), 5
        )

    def test_founding_member_gets_owner_role(self):
        org = OrganizationService.create_organization(user=self.user, name="Acme")
        membership = Membership.objects.get(user=self.user, organization=org)
        self.assertIsNotNone(membership.role)
        self.assertEqual(membership.role.slug, "organization-owner")

    def test_founding_member_status_is_active(self):
        org = OrganizationService.create_organization(user=self.user, name="Acme")
        membership = Membership.objects.get(user=self.user, organization=org)
        self.assertEqual(membership.status, MembershipStatus.ACTIVE)


class CreateRoleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(user=self.user, name="Acme")
        self.owner_membership = Membership.objects.get(
            user=self.user, organization=self.org
        )

    def test_owner_can_create_custom_role(self):
        role = RBACService.create_role(
            organization=self.org,
            name="Support Lead",
            actor_membership=self.owner_membership,
        )
        self.assertEqual(role.name, "Support Lead")
        self.assertFalse(role.is_system_role)

    def test_create_role_with_permissions(self):
        role = RBACService.create_role(
            organization=self.org,
            name="Support Lead",
            permission_codenames=["member.view", "role.view"],
            actor_membership=self.owner_membership,
        )
        perm_codes = set(role.permissions.values_list("codename", flat=True))
        self.assertIn("member.view", perm_codes)
        self.assertIn("role.view", perm_codes)

    def test_duplicate_role_name_rejected(self):
        RBACService.create_role(
            organization=self.org,
            name="Support Lead",
            actor_membership=self.owner_membership,
        )
        with self.assertRaises(OrganizationAccessValidationError):
            RBACService.create_role(
                organization=self.org,
                name="Support Lead",
                actor_membership=self.owner_membership,
            )

    def test_viewer_cannot_create_role(self):
        viewer_user = User.objects.create_user(
            email="viewer@example.com", password="pass123"
        )
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        viewer_membership = Membership.objects.create(
            user=viewer_user,
            organization=self.org,
            role=viewer_role,
            status=MembershipStatus.ACTIVE,
        )
        with self.assertRaises(OrganizationAccessValidationError):
            RBACService.create_role(
                organization=self.org,
                name="New Role",
                actor_membership=viewer_membership,
            )

    def test_unknown_permission_codename_rejected(self):
        with self.assertRaises(OrganizationAccessValidationError):
            RBACService.create_role(
                organization=self.org,
                name="Bad Role",
                permission_codenames=["nonexistent.permission"],
                actor_membership=self.owner_membership,
            )


class UpdateRoleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(user=self.user, name="Acme")
        self.owner_membership = Membership.objects.get(
            user=self.user, organization=self.org
        )
        self.custom_role = RBACService.create_role(
            organization=self.org,
            name="Custom",
            actor_membership=self.owner_membership,
        )

    def test_update_role_name(self):
        updated = RBACService.update_role(
            role=self.custom_role,
            actor_membership=self.owner_membership,
            name="Custom Updated",
        )
        self.assertEqual(updated.name, "Custom Updated")

    def test_system_role_cannot_be_updated(self):
        system_role = Role.objects.get(organization=self.org, slug="viewer")
        with self.assertRaises(OrganizationAccessValidationError) as ctx:
            RBACService.update_role(
                role=system_role,
                actor_membership=self.owner_membership,
                name="Renamed Viewer",
            )
        self.assertEqual(ctx.exception.code, "system_role_protected")

    def test_viewer_cannot_update_role(self):
        viewer_user = User.objects.create_user(
            email="v@example.com", password="pass123"
        )
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        viewer_m = Membership.objects.create(
            user=viewer_user,
            organization=self.org,
            role=viewer_role,
            status=MembershipStatus.ACTIVE,
        )
        with self.assertRaises(OrganizationAccessValidationError):
            RBACService.update_role(
                role=self.custom_role,
                actor_membership=viewer_m,
                name="Hacked",
            )


class DeleteRoleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(user=self.user, name="Acme")
        self.owner_membership = Membership.objects.get(
            user=self.user, organization=self.org
        )
        self.custom_role = RBACService.create_role(
            organization=self.org,
            name="Temp Role",
            actor_membership=self.owner_membership,
        )

    def test_owner_can_delete_custom_role(self):
        role_id = self.custom_role.id
        RBACService.delete_role(
            role=self.custom_role, actor_membership=self.owner_membership
        )
        self.assertFalse(Role.objects.filter(id=role_id).exists())

    def test_system_role_cannot_be_deleted(self):
        system_role = Role.objects.get(organization=self.org, slug="viewer")
        with self.assertRaises(OrganizationAccessValidationError) as ctx:
            RBACService.delete_role(
                role=system_role, actor_membership=self.owner_membership
            )
        self.assertEqual(ctx.exception.code, "system_role_protected")

    def test_viewer_cannot_delete_role(self):
        viewer_user = User.objects.create_user(
            email="v@example.com", password="pass123"
        )
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        viewer_m = Membership.objects.create(
            user=viewer_user,
            organization=self.org,
            role=viewer_role,
            status=MembershipStatus.ACTIVE,
        )
        with self.assertRaises(OrganizationAccessValidationError):
            RBACService.delete_role(role=self.custom_role, actor_membership=viewer_m)


class AssignRoleTest(TestCase):
    def setUp(self):
        self.owner_user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.target_user = User.objects.create_user(
            email="agent@example.com", password="pass123"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner_user, name="Acme"
        )
        self.owner_membership = Membership.objects.get(
            user=self.owner_user, organization=self.org
        )
        self.agent_role = Role.objects.get(organization=self.org, slug="agent")
        self.target_membership = Membership.objects.create(
            user=self.target_user,
            organization=self.org,
            role=self.agent_role,
            status=MembershipStatus.ACTIVE,
        )

    def test_owner_can_assign_role(self):
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        updated = RBACService.assign_role_to_membership(
            membership=self.target_membership,
            role=viewer_role,
            actor_membership=self.owner_membership,
        )
        self.assertEqual(updated.role.slug, "viewer")

    def test_owner_can_remove_role(self):
        updated = RBACService.assign_role_to_membership(
            membership=self.target_membership,
            role=None,
            actor_membership=self.owner_membership,
        )
        self.assertIsNone(updated.role)

    def test_agent_cannot_assign_roles(self):
        """Agent does not have role.assign permission."""
        other_user = User.objects.create_user(
            email="other@example.com", password="pass123"
        )
        other_m = Membership.objects.create(
            user=other_user,
            organization=self.org,
            role=self.agent_role,
            status=MembershipStatus.ACTIVE,
        )
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        with self.assertRaises(OrganizationAccessValidationError) as ctx:
            RBACService.assign_role_to_membership(
                membership=self.target_membership,
                role=viewer_role,
                actor_membership=other_m,
            )
        self.assertEqual(ctx.exception.code, "permission_denied")

    def test_sole_owner_cannot_remove_own_owner_role(self):
        with self.assertRaises(OrganizationAccessValidationError) as ctx:
            RBACService.assign_role_to_membership(
                membership=self.owner_membership,
                role=self.agent_role,
                actor_membership=self.owner_membership,
            )
        self.assertEqual(ctx.exception.code, "sole_owner_protected")

    def test_non_owner_cannot_assign_owner_role(self):
        admin_user = User.objects.create_user(
            email="admin@example.com", password="pass123"
        )
        admin_role = Role.objects.get(organization=self.org, slug="organization-admin")
        admin_m = Membership.objects.create(
            user=admin_user,
            organization=self.org,
            role=admin_role,
            status=MembershipStatus.ACTIVE,
        )
        owner_role = Role.objects.get(organization=self.org, slug="organization-owner")
        with self.assertRaises(OrganizationAccessValidationError) as ctx:
            RBACService.assign_role_to_membership(
                membership=self.target_membership,
                role=owner_role,
                actor_membership=admin_m,
            )
        self.assertEqual(ctx.exception.code, "owner_escalation")
