from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase
from organizations.models import Membership, MembershipStatus, Organization
from organizations.services import OrganizationService
from rest_framework.exceptions import ValidationError

User = get_user_model()


class OrganizationServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="testpass123",
        )

    def test_create_organization_with_membership(self):
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        self.assertEqual(organization.name, "Acme Corp")
        self.assertTrue(
            Membership.objects.filter(
                user=self.user,
                organization=organization,
                status=MembershipStatus.ACTIVE,
            ).exists()
        )

    def test_create_organization_generates_slug(self):
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        self.assertEqual(organization.slug, "acme-corp")

    def test_create_organization_requires_name(self):
        with self.assertRaises(ValidationError):
            OrganizationService.create_organization(user=self.user, name="   ")

    def test_create_organization_generates_unique_slug_on_collision(self):
        Organization.objects.create(name="Acme Corp", slug="acme-corp")
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        self.assertEqual(organization.slug, "acme-corp-1")
        self.assertEqual(Membership.objects.filter(user=self.user).count(), 1)

    def test_validate_organization_access_active_member(self):
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        membership = OrganizationService.validate_organization_access(
            self.user,
            organization,
        )
        self.assertEqual(membership.status, MembershipStatus.ACTIVE)

    def test_validate_organization_access_not_member(self):
        organization = Organization.objects.create(name="Acme Corp", slug="acme-corp")
        with self.assertRaises(ValidationError) as exc:
            OrganizationService.validate_organization_access(self.user, organization)
        self.assertEqual(exc.exception.code, "not_found")

    def test_validate_organization_access_suspended_membership(self):
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        membership = Membership.objects.get(user=self.user, organization=organization)
        membership.status = MembershipStatus.SUSPENDED
        membership.save(update_fields=["status"])

        with self.assertRaises(ValidationError) as exc:
            OrganizationService.validate_organization_access(self.user, organization)
        self.assertEqual(exc.exception.code, "membership_suspended")

    def test_validate_organization_access_removed_membership(self):
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        membership = Membership.objects.get(user=self.user, organization=organization)
        membership.status = MembershipStatus.REMOVED
        membership.save(update_fields=["status"])

        with self.assertRaises(ValidationError) as exc:
            OrganizationService.validate_organization_access(self.user, organization)
        self.assertEqual(exc.exception.code, "membership_removed")

    def test_transaction_rolls_back_on_membership_failure(self):
        organization = Organization.objects.create(name="Existing", slug="existing")

        with self.assertRaises(Exception), transaction.atomic():  # noqa: B017
            Organization.objects.create(name="Broken", slug="broken")
            Membership.objects.create(
                user=self.user,
                organization=organization,
            )
            Membership.objects.create(
                user=self.user,
                organization=organization,
            )

        self.assertFalse(Organization.objects.filter(slug="broken").exists())
