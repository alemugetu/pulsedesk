"""
Report Selector Tests — Phase 13.5

Tests for database aggregation selectors.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone as django_timezone
from incidents.models import (
    Incident,
    IncidentCategory,
    IncidentPriority,
    IncidentStatus,
)
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from reports.selectors import (
    get_average_resolution_time,
    get_escalation_activity,
    get_incident_summary,
    get_incident_trend,
    get_incidents_by_category,
    get_incidents_by_priority,
    get_incidents_by_status,
    get_sla_performance,
    parse_date_range,
)
from sla.models import SLAPolicy, SLATarget

User = get_user_model()


def _add_member(user, org, role_slug):
    """Helper function to add a member with a system role."""
    role = Role.objects.get(organization=org, slug=role_slug, is_system_role=True)
    return Membership.objects.create(
        user=user, organization=org, role=role, status=MembershipStatus.ACTIVE
    )


class DateRangeTests(TestCase):
    """Test date range parsing and validation."""

    def test_parse_date_range_defaults(self):
        """Test default date range (last 30 days)."""
        start, end = parse_date_range()
        self.assertEqual((end - start).days, 30)
        self.assertGreater(end, start)

    def test_parse_date_range_custom(self):
        """Test custom date range."""
        start_str = "2026-01-01T00:00:00Z"
        end_str = "2026-01-31T23:59:59Z"
        start, end = parse_date_range(start=start_str, end=end_str)
        self.assertEqual(start.day, 1)
        self.assertEqual(end.day, 31)

    def test_parse_date_range_invalid_start(self):
        """Test invalid start date falls back to default."""
        start, end = parse_date_range(start="invalid", end="2026-01-31T23:59:59Z")
        self.assertEqual((end - start).days, 30)


class IncidentSummaryTests(TestCase):
    """Test incident summary selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        # Seed system roles to ensure they exist
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)
        self.category = IncidentCategory.objects.create(
            organization=self.organization,
            name="Server Issues",
            slug="server-issues",
        )
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

    def test_incident_summary_empty(self):
        """Test summary with no incidents."""
        summary = get_incident_summary(self.organization)
        self.assertEqual(summary["total_incidents"], 0)
        self.assertEqual(summary["open_incidents"], 0)
        self.assertEqual(summary["resolved_incidents"], 0)
        self.assertEqual(summary["closed_incidents"], 0)
        self.assertEqual(summary["unassigned_incidents"], 0)
        self.assertEqual(summary["critical_incidents"], 0)

    def test_incident_summary_basic(self):
        """Test basic incident summary."""
        # Create incidents with different statuses
        now = django_timezone.now()
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident 1",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P1,
            reporter=self.user,
            assignee=self.membership,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-002",
            title="Test Incident 2",
            status=IncidentStatus.RESOLVED,
            priority=IncidentPriority.P2,
            reporter=self.user,
            assignee=self.membership,
            resolved_at=now,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-003",
            title="Test Incident 3",
            status=IncidentStatus.CLOSED,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        summary = get_incident_summary(self.organization)

        self.assertEqual(summary["total_incidents"], 3)
        self.assertEqual(summary["open_incidents"], 1)
        self.assertEqual(summary["resolved_incidents"], 1)
        self.assertEqual(summary["closed_incidents"], 1)
        self.assertEqual(summary["critical_incidents"], 1)

    def test_incident_summary_unassigned(self):
        """Test unassigned incident count."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=None,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-002",
            title="Test Incident 2",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            reporter=self.user,
            assignee=self.membership,
        )

        summary = get_incident_summary(self.organization)
        self.assertEqual(summary["unassigned_incidents"], 1)


class IncidentsByStatusTests(TestCase):
    """Test incidents by status selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)

    def test_incidents_by_status_empty(self):
        """Test status breakdown with no incidents."""
        counts = get_incidents_by_status(self.organization)
        for status in IncidentStatus.values:
            self.assertEqual(counts[status], 0)

    def test_incidents_by_status_distribution(self):
        """Test status distribution."""
        for status in IncidentStatus.values:
            Incident.objects.create(
                organization=self.organization,
                incident_number=f"INC-{status}",
                title=f"Test {status}",
                status=status,
                priority=IncidentPriority.P3,
                reporter=self.user,
                assignee=self.membership,
            )

        counts = get_incidents_by_status(self.organization)
        for status in IncidentStatus.values:
            self.assertEqual(counts[status], 1)


class IncidentsByPriorityTests(TestCase):
    """Test incidents by priority selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)

    def test_incidents_by_priority_empty(self):
        """Test priority breakdown with no incidents."""
        counts = get_incidents_by_priority(self.organization)
        for priority in IncidentPriority.values:
            self.assertEqual(counts[priority], 0)

    def test_incidents_by_priority_distribution(self):
        """Test priority distribution."""
        for priority in IncidentPriority.values:
            Incident.objects.create(
                organization=self.organization,
                incident_number=f"INC-{priority}",
                title=f"Test {priority}",
                status=IncidentStatus.OPEN,
                priority=priority,
                reporter=self.user,
                assignee=self.membership,
            )

        counts = get_incidents_by_priority(self.organization)
        for priority in IncidentPriority.values:
            self.assertEqual(counts[priority], 1)


class IncidentsByCategoryTests(TestCase):
    """Test incidents by category selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)
        self.category = IncidentCategory.objects.create(
            organization=self.organization,
            name="Server Issues",
            slug="server-issues",
        )

    def test_incidents_by_category_empty(self):
        """Test category breakdown with no incidents."""
        counts = get_incidents_by_category(self.organization)
        self.assertEqual(counts, [])

    def test_incidents_by_category_with_categories(self):
        """Test category distribution."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            category=self.category,
            reporter=self.user,
            assignee=self.membership,
        )
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-002",
            title="Test Incident 2",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            category=self.category,
            reporter=self.user,
            assignee=self.membership,
        )

        counts = get_incidents_by_category(self.organization)
        self.assertEqual(len(counts), 1)
        self.assertEqual(counts[0]["category_name"], self.category.name)
        self.assertEqual(counts[0]["count"], 2)

    def test_incidents_by_category_uncategorized(self):
        """Test uncategorized incidents."""
        Incident.objects.create(
            organization=self.organization,
            incident_number="INC-001",
            title="Test Incident",
            status=IncidentStatus.OPEN,
            priority=IncidentPriority.P3,
            category=None,
            reporter=self.user,
            assignee=self.membership,
        )

        counts = get_incidents_by_category(self.organization)
        self.assertEqual(len(counts), 1)
        self.assertEqual(counts[0]["category_name"], "Uncategorized")
        self.assertIsNone(counts[0]["category_id"])


class IncidentTrendTests(TestCase):
    """Test incident trend selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)

    def test_incident_trend_daily(self):
        """Test daily trend aggregation."""
        # Create incidents on different dates to test daily grouping
        base_date = django_timezone.now()
        for i in range(3):
            Incident.objects.create(
                organization=self.organization,
                incident_number=f"INC-{i}",
                title=f"Test Incident {i}",
                status=IncidentStatus.OPEN,
                priority=IncidentPriority.P3,
                reporter=self.user,
                assignee=self.membership,
                created_at=base_date - django_timezone.timedelta(days=i),
            )

        trend = get_incident_trend(self.organization, granularity="daily")
        self.assertEqual(len(trend), 3)
        for item in trend:
            self.assertIn("date", item)
            self.assertIn("count", item)

    def test_incident_trend_invalid_granularity(self):
        """Test invalid granularity raises ValueError."""
        with self.assertRaises(ValueError):
            get_incident_trend(self.organization, granularity="hourly")


class SLAPerformanceTests(TestCase):
    """Test SLA performance selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)
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

    def test_sla_performance_empty(self):
        """Test SLA metrics with no incidents."""
        metrics = get_sla_performance(self.organization)
        self.assertEqual(metrics["total_sla_incidents"], 0)
        self.assertEqual(metrics["compliant_incidents"], 0)
        self.assertEqual(metrics["breached_incidents"], 0)
        self.assertEqual(metrics["compliance_percentage"], 0.0)


class AverageResolutionTimeTests(TestCase):
    """Test average resolution time selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)

    def test_average_resolution_time_empty(self):
        """Test resolution time with no resolved incidents."""
        metrics = get_average_resolution_time(self.organization)
        self.assertEqual(metrics["average_resolution_seconds"], 0)
        self.assertEqual(metrics["resolved_incident_count"], 0)


class EscalationActivityTests(TestCase):
    """Test escalation activity selector."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.organization = OrganizationService.create_organization(
            user=self.user, name="Test Organization"
        )
        from organizations.services import RBACService

        RBACService.seed_system_roles(self.organization)
        self.membership = self.user.memberships.get(organization=self.organization)
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

    def test_escalation_activity_empty(self):
        """Test escalation metrics with no events."""
        metrics = get_escalation_activity(self.organization)
        self.assertEqual(metrics["total_escalation_events"], 0)
        self.assertEqual(metrics["by_level"], {})
        self.assertEqual(metrics["by_trigger_type"], {})
