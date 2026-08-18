"""
Tests for WebSocket authentication and authorization.
"""

from accounts.models import User
from django.test import TestCase
from organizations.models import Membership, Organization, Role
from realtime.permissions import (
    WebSocketAuthenticationError,
    WebSocketPermissionError,
)


class TestWebSocketErrors(TestCase):
    """Test WebSocket error classes."""

    def test_authentication_error_creation(self):
        """Test that authentication error can be created with code."""
        error = WebSocketAuthenticationError("Test message", "test_code")
        self.assertEqual(error.message, "Test message")
        self.assertEqual(error.code, "test_code")

    def test_permission_error_creation(self):
        """Test that permission error can be created with code."""
        error = WebSocketPermissionError("Test message", "test_code")
        self.assertEqual(error.message, "Test message")
        self.assertEqual(error.code, "test_code")


class TestWebSocketAuthorizationLogic(TestCase):
    """Test WebSocket authorization logic components."""

    def setUp(self):
        """Set up test data."""
        from django.utils import timezone

        self.organization = Organization.objects.create(
            name="Test Organization",
            slug="test-org",
            status="ACTIVE",
        )
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.user.email_verified_at = timezone.now()
        self.user.save()
        self.role = Role.objects.create(
            organization=self.organization,
            name="Test Role",
            slug="test-role",
        )
        self.membership = Membership.objects.create(
            user=self.user,
            organization=self.organization,
            role=self.role,
            status="ACTIVE",
        )

        # Create another organization for cross-tenant testing
        self.other_org = Organization.objects.create(
            name="Other Organization",
            slug="other-org",
            status="ACTIVE",
        )

    def test_active_membership_allows_access(self):
        """Test that active membership allows access."""
        from organizations.services import OrganizationService

        # This should not raise an error
        membership = OrganizationService.validate_organization_access(
            self.user, self.organization
        )
        self.assertEqual(membership.id, self.membership.id)

    def test_non_member_denied_access(self):
        """Test that non-members are denied access."""
        from organizations.services import OrganizationService
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError) as context:
            OrganizationService.validate_organization_access(self.user, self.other_org)
        self.assertEqual(context.exception.code, "not_found")

    def test_suspended_member_denied_access(self):
        """Test that suspended members are denied access."""
        from organizations.services import OrganizationService
        from rest_framework.exceptions import ValidationError

        # Suspend the membership
        self.membership.status = "SUSPENDED"
        self.membership.save()

        with self.assertRaises(ValidationError) as context:
            OrganizationService.validate_organization_access(
                self.user, self.organization
            )
        self.assertEqual(context.exception.code, "membership_suspended")
