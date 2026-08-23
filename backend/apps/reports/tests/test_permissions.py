"""
Report Permission Tests — Phase 13.5

Tests for RBAC permission checks on report endpoints.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService, RBACService
from rest_framework.test import APIClient

User = get_user_model()


def _add_member(user, org, role_slug):
    """Helper function to add a member with a system role."""
    role = Role.objects.get(organization=org, slug=role_slug, is_system_role=True)
    return Membership.objects.create(
        user=user, organization=org, role=role, status=MembershipStatus.ACTIVE
    )


class AuthenticationTests(TestCase):
    """Test authentication requirements."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        RBACService.seed_system_roles(self.organization)
        self.api_client = APIClient()

    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied."""
        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 401)


class OrganizationMembershipTests(TestCase):
    """Test organization membership requirements."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        RBACService.seed_system_roles(self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_non_member_access_denied(self):
        """Test that non-organization members are denied."""
        other_org = OrganizationService.create_organization(
            user=User.objects.create_user(
                email="other@example.com",
                password="testpass123",
            ),
            name="Other Organization",
        )
        response = self.api_client.get(
            f"/api/v1/organizations/{other_org.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 404)


class RBACPermissionTests(TestCase):
    """Test RBAC permission checks."""

    def setUp(self):
        """Set up test data."""
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.owner, name="Test Organization"
        )
        RBACService.seed_system_roles(self.organization)
        self.api_client = APIClient()

    def test_viewer_cannot_view_reports(self):
        """Test that Viewer role cannot access reports."""
        viewer_user = User.objects.create_user(
            email="viewer@example.com",
            password="testpass123",
        )
        _add_member(viewer_user, self.organization, "viewer")
        self.api_client.force_authenticate(user=viewer_user)

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 403)

    def test_agent_can_view_reports(self):
        """Test that Agent role can access reports."""
        agent_user = User.objects.create_user(
            email="agent@example.com",
            password="testpass123",
        )
        _add_member(agent_user, self.organization, "agent")
        self.api_client.force_authenticate(user=agent_user)

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 200)

    def test_operations_manager_can_view_reports(self):
        """Test that Operations Manager role can access reports."""
        ops_user = User.objects.create_user(
            email="ops@example.com",
            password="testpass123",
        )
        _add_member(ops_user, self.organization, "operations-manager")
        self.api_client.force_authenticate(user=ops_user)

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 200)

    def test_admin_can_view_reports(self):
        """Test that Admin role can access reports."""
        admin_user = User.objects.create_user(
            email="admin@example.com",
            password="testpass123",
        )
        _add_member(admin_user, self.organization, "organization-admin")
        self.api_client.force_authenticate(user=admin_user)

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 200)

    def test_owner_can_view_reports(self):
        """Test that Owner role can access reports."""
        self.api_client.force_authenticate(user=self.owner)

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 200)


class CrossTenantIsolationTests(TestCase):
    """Test cross-tenant data isolation."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        RBACService.seed_system_roles(self.organization)
        # Update existing membership to agent role (created by OrganizationService)
        membership = Membership.objects.get(
            user=self.user, organization=self.organization
        )
        membership.role = Role.objects.get(organization=self.organization, slug="agent")
        membership.save()

        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        self.other_org = OrganizationService.create_organization(
            user=self.other_user, name="Other Organization"
        )
        RBACService.seed_system_roles(self.other_org)
        # Update existing membership to agent role (created by OrganizationService)
        other_membership = Membership.objects.get(
            user=self.other_user, organization=self.other_org
        )
        other_membership.role = Role.objects.get(
            organization=self.other_org, slug="agent"
        )
        other_membership.save()

        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_cross_tenant_organization_isolation(self):
        """Test that users cannot access reports for other organizations."""
        response = self.api_client.get(
            f"/api/v1/organizations/{self.other_org.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 404)

    def test_cross_tenant_data_isolation(self):
        """Test that report data cannot include other organization's data."""
        from incidents.models import Incident, IncidentPriority, IncidentStatus

        # Create incident in other organization
        Incident.objects.create(
            organization=self.other_org,
            incident_number="INC-OTHER-001",
            title="Other Org Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.other_user,
            assignee=self.other_user.memberships.get(organization=self.other_org),
        )

        # Access reports for user's organization
        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )
        self.assertEqual(response.status_code, 200)

        # Verify response only includes user's org data
        data = response.json()
        self.assertEqual(data["total_incidents"], 0)


class IDORPreventionTests(TestCase):
    """Test IDOR prevention via UUID guessing."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        RBACService.seed_system_roles(self.organization)
        # Update existing membership to agent role (created by OrganizationService)
        membership = Membership.objects.get(
            user=self.user, organization=self.organization
        )
        membership.role = Role.objects.get(organization=self.organization, slug="agent")
        membership.save()
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_idor_prevention_via_uuid_guessing(self):
        """Test that UUID guessing cannot bypass organization membership."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"

        response = self.api_client.get(
            f"/api/v1/organizations/{fake_uuid}/reports/summary/"
        )
        self.assertEqual(response.status_code, 404)
