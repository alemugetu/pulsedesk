"""
Report View Tests — Phase 13.5

Tests for report API views and endpoints.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone as django_timezone
from incidents.models import Incident, IncidentPriority, IncidentStatus
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService, RBACService
from rest_framework.test import APIClient
from sla.models import SLAPolicy, SLATarget

User = get_user_model()


def _add_member(user, org, role_slug):
    """Helper function to add a member with a system role."""
    role = Role.objects.get(organization=org, slug=role_slug, is_system_role=True)
    return Membership.objects.create(
        user=user, organization=org, role=role, status=MembershipStatus.ACTIVE
    )


class IncidentSummaryViewTests(TestCase):
    """Test incident summary view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

        # Set up SLA policy
        self.sla_policy = SLAPolicy.objects.create(
            organization=self.organization,
            name="Default SLA",
            is_active=True,
            is_default=True,
        )
        for priority in IncidentPriority.values:
            SLATarget.objects.create(
                policy=self.sla_policy,
                priority=priority,
                response_time_minutes=30,
                resolution_time_minutes=240,
            )

    def test_incident_summary_view_success(self):
        """Test successful incident summary request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-002",
            title="Test Incident 2",
            status=IncidentStatus.RESOLVED,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
            resolved_at=django_timezone.now(),
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/summary/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_incidents", data)
        self.assertIn("open_incidents", data)
        self.assertIn("resolved_incidents", data)
        self.assertEqual(data["total_incidents"], 2)


class IncidentsByStatusViewTests(TestCase):
    """Test incidents by status view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_incidents_by_status_view_success(self):
        """Test successful incidents by status request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-002",
            title="Test Incident 2",
            status=IncidentStatus.RESOLVED,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/by-status/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("OPEN", data)
        self.assertIn("RESOLVED", data)
        self.assertEqual(data["OPEN"], 1)
        self.assertEqual(data["RESOLVED"], 1)


class IncidentsByPriorityViewTests(TestCase):
    """Test incidents by priority view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_incidents_by_priority_view_success(self):
        """Test successful incidents by priority request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P1,
            reporter=self.user,
            assignee=self.membership,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-002",
            title="Test Incident 2",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P2,
            reporter=self.user,
            assignee=self.membership,
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/by-priority/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("P1", data)
        self.assertIn("P2", data)
        self.assertEqual(data["P1"], 1)
        self.assertEqual(data["P2"], 1)


class IncidentsByCategoryViewTests(TestCase):
    """Test incidents by category view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_incidents_by_category_view_success(self):
        """Test successful incidents by category request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/by-category/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("categories", data)
        self.assertIsInstance(data["categories"], list)


class IncidentTrendViewTests(TestCase):
    """Test incident trend view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_incident_trend_view_daily(self):
        """Test incident trend with daily granularity."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/trend/",
            {"granularity": "daily"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("granularity", data)
        self.assertIn("data", data)
        self.assertEqual(data["granularity"], "daily")

    def test_incident_trend_view_invalid_granularity(self):
        """Test incident trend with invalid granularity."""
        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/trend/",
            {"granularity": "hourly"},
        )

        self.assertEqual(response.status_code, 400)


class SLAPerformanceViewTests(TestCase):
    """Test SLA performance view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

        # Set up SLA policy
        self.sla_policy = SLAPolicy.objects.create(
            organization=self.organization,
            name="Default SLA",
            is_active=True,
            is_default=True,
        )
        for priority in IncidentPriority.values:
            SLATarget.objects.create(
                policy=self.sla_policy,
                priority=priority,
                response_time_minutes=30,
                resolution_time_minutes=240,
            )

    def test_sla_performance_view_success(self):
        """Test successful SLA performance request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/sla/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_sla_incidents", data)
        self.assertIn("compliance_percentage", data)


class AverageResolutionTimeViewTests(TestCase):
    """Test average resolution time view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_average_resolution_time_view_success(self):
        """Test successful average resolution time request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.RESOLVED,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
            resolved_at=django_timezone.now(),
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/resolution-time/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("average_resolution_seconds", data)
        self.assertIn("resolved_incident_count", data)


class EscalationActivityViewTests(TestCase):
    """Test escalation activity view."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_escalation_activity_view_success(self):
        """Test successful escalation activity request."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        response = self.api_client.get(
            f"/api/v1/organizations/{self.organization.id}/reports/escalations/"
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_escalation_events", data)
        self.assertIn("by_level", data)
        self.assertIn("by_trigger_type", data)


class ResponseFormatTests(TestCase):
    """Test response formats across all endpoints."""

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
        self.membership = self.user.memberships.get(organization=self.organization)
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def test_all_endpoints_return_json(self):
        """Test that all report endpoints return JSON."""
        endpoints = [
            f"/api/v1/organizations/{self.organization.id}/reports/summary/",
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/by-status/",
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/by-priority/",
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/by-category/",
            f"/api/v1/organizations/{self.organization.id}/reports/incidents/trend/",
            f"/api/v1/organizations/{self.organization.id}/reports/sla/",
            f"/api/v1/organizations/{self.organization.id}/reports/resolution-time/",
            f"/api/v1/organizations/{self.organization.id}/reports/escalations/",
        ]

        for endpoint in endpoints:
            response = self.api_client.get(endpoint)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Content-Type"], "application/json")
