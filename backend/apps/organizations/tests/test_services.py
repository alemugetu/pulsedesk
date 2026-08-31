from django.contrib.auth import get_user_model
from django.core import mail
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

    def test_add_member_sends_verification_email_for_unverified_user(self):
        """Test that adding an unverified user sends a verification email."""
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        
        # Create an unverified user
        unverified_user = User.objects.create_user(
            email="unverified@example.com",
            password="testpass123",
            first_name="John",
            last_name="Doe",
        )
        
        # Clear mail outbox
        mail.outbox = []
        
        # Add the unverified user to the organization
        membership = OrganizationService.add_member(
            organization=organization,
            user=unverified_user,
        )
        
        # Check that membership was created
        self.assertEqual(membership.user, unverified_user)
        self.assertEqual(membership.organization, organization)
        self.assertEqual(membership.status, MembershipStatus.ACTIVE)
        
        # Check that verification email was sent
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("verify", email.subject.lower())
        self.assertEqual(email.to, [unverified_user.email])

    def test_add_member_does_not_send_verification_email_for_verified_user(self):
        """Test that adding a verified user does not send a verification email."""
        organization = OrganizationService.create_organization(
            user=self.user,
            name="Acme Corp",
        )
        
        # Create a verified user
        verified_user = User.objects.create_user(
            email="verified@example.com",
            password="testpass123",
            first_name="Jane",
            last_name="Smith",
        )
        # Mark user as verified
        from django.utils import timezone
        verified_user.email_verified_at = timezone.now()
        verified_user.save(update_fields=["email_verified_at"])
        
        # Clear mail outbox
        mail.outbox = []
        
        # Add the verified user to the organization
        membership = OrganizationService.add_member(
            organization=organization,
            user=verified_user,
        )
        
        # Check that membership was created
        self.assertEqual(membership.user, verified_user)
        self.assertEqual(membership.organization, organization)
        self.assertEqual(membership.status, MembershipStatus.ACTIVE)
        
        # Check that verification email was NOT sent
        self.assertEqual(len(mail.outbox), 0)
