from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Membership, MembershipStatus, Organization
from organizations.selectors import (
    get_active_membership,
    get_organization_by_id,
    list_organization_members,
    list_user_organizations,
    user_has_active_membership,
)

User = get_user_model()


class OrganizationSelectorsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="member@example.com",
            password="testpass123",
        )
        self.organization = Organization.objects.create(
            name="Acme Corp",
            slug="acme-corp",
        )
        self.membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
        )

    def test_get_organization_by_id(self):
        result = get_organization_by_id(self.organization.id)
        self.assertEqual(result, self.organization)

    def test_get_organization_by_id_not_found(self):
        import uuid

        self.assertIsNone(get_organization_by_id(uuid.uuid4()))

    def test_list_user_organizations(self):
        organizations = list(list_user_organizations(self.user))
        self.assertEqual(len(organizations), 1)
        self.assertEqual(organizations[0], self.organization)

    def test_list_user_organizations_excludes_suspended_membership(self):
        self.membership.status = MembershipStatus.SUSPENDED
        self.membership.save(update_fields=["status"])
        self.assertEqual(list_user_organizations(self.user).count(), 0)

    def test_get_active_membership(self):
        membership = get_active_membership(self.user, self.organization)
        self.assertEqual(membership, self.membership)

    def test_list_organization_members(self):
        members = list(list_organization_members(self.organization))
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0].user, self.user)

    def test_user_has_active_membership(self):
        self.assertTrue(user_has_active_membership(self.user, self.organization))
