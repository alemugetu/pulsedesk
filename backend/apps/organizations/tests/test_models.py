from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    OrganizationStatus,
)

User = get_user_model()


class OrganizationModelTest(TestCase):
    def test_create_organization(self):
        organization = Organization.objects.create(
            name="Acme Corp",
            slug="acme-corp",
        )
        self.assertEqual(organization.name, "Acme Corp")
        self.assertEqual(organization.slug, "acme-corp")
        self.assertEqual(organization.status, OrganizationStatus.ACTIVE)
        self.assertIsNotNone(organization.id)

    def test_slug_uniqueness(self):
        Organization.objects.create(name="Acme Corp", slug="acme-corp")
        with self.assertRaises(IntegrityError):
            Organization.objects.create(name="Acme Corp 2", slug="acme-corp")

    def test_slug_normalization(self):
        self.assertEqual(Organization.normalize_slug("Acme Corp"), "acme-corp")

    def test_status_choices(self):
        organization = Organization.objects.create(
            name="Suspended Org",
            slug="suspended-org",
            status=OrganizationStatus.SUSPENDED,
        )
        self.assertEqual(organization.status, OrganizationStatus.SUSPENDED)


class MembershipModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="member@example.com",
            password="testpass123",
        )
        self.organization = Organization.objects.create(
            name="Acme Corp",
            slug="acme-corp",
        )

    def test_create_membership(self):
        membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
        )
        self.assertEqual(membership.status, MembershipStatus.ACTIVE)
        self.assertIsNotNone(membership.id)

    def test_duplicate_membership_prevented(self):
        Membership.objects.create(user=self.user, organization=self.organization)
        with self.assertRaises(IntegrityError):
            Membership.objects.create(user=self.user, organization=self.organization)

    def test_membership_status_values(self):
        membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
            status=MembershipStatus.SUSPENDED,
        )
        self.assertEqual(membership.status, MembershipStatus.SUSPENDED)
