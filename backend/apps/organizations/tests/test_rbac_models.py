"""Tests for RBAC models: Permission, Role, RolePermission, and Membership.role."""

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from organizations.models import (
    Membership,
    Organization,
    Permission,
    Role,
    RolePermission,
)

User = get_user_model()


def _make_org(name="Acme", slug=None):
    slug = slug or Organization.normalize_slug(name)
    return Organization.objects.create(name=name, slug=slug)


def _make_user(email="user@example.com"):
    return User.objects.create_user(email=email, password="testpass123")


def _make_perm(codename="test.action"):
    resource, action = codename.split(".")
    return Permission.objects.create(
        codename=codename,
        name=codename,
        resource=resource,
        action=action,
    )


def _make_role(org, name="Tester", slug=None):
    slug = slug or Role.normalize_slug(name)
    return Role.objects.create(organization=org, name=name, slug=slug)


class PermissionModelTest(TestCase):
    def test_create_permission(self):
        p = _make_perm("organization.view")
        self.assertEqual(str(p), "organization.view")
        self.assertEqual(p.resource, "organization")
        self.assertEqual(p.action, "view")

    def test_codename_unique(self):
        _make_perm("organization.view")
        with self.assertRaises(IntegrityError):
            _make_perm("organization.view")


class RoleModelTest(TestCase):
    def setUp(self):
        self.org = _make_org()

    def test_create_role(self):
        role = _make_role(self.org, "Admin")
        self.assertEqual(role.name, "Admin")
        self.assertEqual(role.organization, self.org)
        self.assertFalse(role.is_system_role)
        self.assertIsNotNone(role.id)

    def test_slug_unique_within_org(self):
        _make_role(self.org, "Admin", slug="admin")
        with self.assertRaises(IntegrityError):
            _make_role(self.org, "Admin2", slug="admin")

    def test_slug_reusable_across_orgs(self):
        org2 = _make_org("Beta", "beta")
        _make_role(self.org, "Admin", slug="admin")
        role2 = _make_role(org2, "Admin", slug="admin")  # should not raise
        self.assertEqual(role2.slug, "admin")

    def test_system_role_flag(self):
        role = Role.objects.create(
            organization=self.org,
            name="Owner",
            slug="owner",
            is_system_role=True,
        )
        self.assertTrue(role.is_system_role)

    def test_normalize_slug(self):
        self.assertEqual(Role.normalize_slug("My Role"), "my-role")


class RolePermissionModelTest(TestCase):
    def setUp(self):
        self.org = _make_org()
        self.role = _make_role(self.org)
        self.perm = _make_perm("role.test")

    def test_attach_permission_to_role(self):
        rp = RolePermission.objects.create(role=self.role, permission=self.perm)
        self.assertIsNotNone(rp.id)
        self.assertIn(self.perm, self.role.permissions.all())

    def test_duplicate_role_permission_prevented(self):
        RolePermission.objects.create(role=self.role, permission=self.perm)
        with self.assertRaises(IntegrityError):
            RolePermission.objects.create(role=self.role, permission=self.perm)


class MembershipRoleFieldTest(TestCase):
    def setUp(self):
        self.org = _make_org()
        self.user = _make_user()
        self.role = _make_role(self.org)

    def test_membership_role_nullable(self):
        m = Membership.objects.create(user=self.user, organization=self.org, role=None)
        self.assertIsNone(m.role)

    def test_membership_with_role(self):
        m = Membership.objects.create(
            user=self.user, organization=self.org, role=self.role
        )
        m.refresh_from_db()
        self.assertEqual(m.role, self.role)

    def test_membership_role_set_null_on_role_delete(self):
        m = Membership.objects.create(
            user=self.user, organization=self.org, role=self.role
        )
        self.role.delete()
        m.refresh_from_db()
        self.assertIsNone(m.role)
