"""
Tests for WebSocket authentication and authorization.
"""

from django.test import TestCase, override_settings

from accounts.models import User
from organizations.models import Membership, Organization, Role
from realtime.permissions import (
    SUBPROTOCOL_AUTH_PREFIX,
    WebSocketAuthenticationError,
    WebSocketPermissionError,
    extract_bearer_token,
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


class TestExtractBearerToken(TestCase):
    """Test JWT extraction from WebSocket connection scope."""

    SAMOA_JWT = (
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0."
        "dGVzdC1zaWduYXR1cmU"
    )

    def _scope(self, headers=None, subprotocols=None):
        return {
            "headers": headers or [],
            "subprotocols": subprotocols or [],
        }

    def test_header_authorization_wins(self):
        """The Authorization header is always preferred."""
        scope = self._scope(
            headers=[("AUTHORIZATION".encode(), f"Bearer {self.SAMOA_JWT}".encode())],
            subprotocols=[f"{SUBPROTOCOL_AUTH_PREFIX}other-token"],
        )
        self.assertEqual(extract_bearer_token(scope), self.SAMOA_JWT)

    def test_header_without_bearer_prefix_ignored(self):
        """An Authorization header without 'Bearer' yields no token."""
        scope = self._scope(
            headers=[("AUTHORIZATION".encode(), self.SAMOA_JWT.encode())]
        )
        self.assertIsNone(extract_bearer_token(scope))

    def test_subprotocol_enabled(self):
        """The offered subprotocol is used when subprotocol auth is enabled."""
        scope = self._scope(subprotocols=[f"{SUBPROTOCOL_AUTH_PREFIX}{self.SAMOA_JWT}"])
        with override_settings(REALTIME_ALLOW_SUBPROTOCOL_AUTH=True):
            self.assertEqual(extract_bearer_token(scope), self.SAMOA_JWT)

    def test_subprotocol_disabled_by_default(self):
        """Subprotocol auth is rejected unless explicitly enabled."""
        scope = self._scope(subprotocols=[f"{SUBPROTOCOL_AUTH_PREFIX}{self.SAMOA_JWT}"])
        with override_settings(REALTIME_ALLOW_SUBPROTOCOL_AUTH=False):
            self.assertIsNone(extract_bearer_token(scope))

    def test_unrelated_subprotocols_ignored(self):
        """Only the PulseDesk subprotocol carries the token."""
        scope = self._scope(
            subprotocols=["graphql-ws", "superchat"]
        )
        with override_settings(REALTIME_ALLOW_SUBPROTOCOL_AUTH=True):
            self.assertIsNone(extract_bearer_token(scope))


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
