from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from incidents.models import (
    Incident,
    IncidentCategory,
    IncidentPriority,
    IncidentStatus,
)
from incidents.services import CategoryService, IncidentService
from organizations.models import Membership
from organizations.services import OrganizationService

User = get_user_model()


class IncidentModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.owner_membership = Membership.objects.get(
            user=self.user, organization=self.org
        )

    def test_category_creation_and_constraints(self):
        category = CategoryService.create_category(
            organization=self.org,
            name="Infrastructure",
            description="Hardware and cloud servers",
        )
        self.assertEqual(category.name, "Infrastructure")
        self.assertEqual(category.slug, "infrastructure")
        self.assertTrue(category.is_active)
        self.assertEqual(category.organization, self.org)

        # Unique name constraint in same org
        with self.assertRaises(IntegrityError):
            IncidentCategory.objects.create(
                organization=self.org,
                name="Infrastructure",
                slug="infra-2",
            )

    def test_incident_creation_and_incident_number(self):
        category = CategoryService.create_category(
            organization=self.org, name="Application"
        )
        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Database Connection Latency",
            description="Queries timing out",
            category_id=str(category.id),
            priority=IncidentPriority.P1,
        )

        self.assertIsNotNone(incident.id)
        self.assertEqual(incident.incident_number, "INC-000001")
        self.assertEqual(incident.status, IncidentStatus.OPEN)
        self.assertEqual(incident.priority, IncidentPriority.P1)
        self.assertEqual(incident.reporter, self.user)
        self.assertEqual(incident.category, category)
        self.assertIsNone(incident.resolved_at)

        # Sequential numbering
        incident2 = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Second Incident",
        )
        self.assertEqual(incident2.incident_number, "INC-000002")

    def test_incident_number_uniqueness_constraint(self):
        Incident.objects.create(
            organization=self.org,
            incident_number="INC-000001",
            title="First",
            reporter=self.user,
        )
        with self.assertRaises(IntegrityError):
            Incident.objects.create(
                organization=self.org,
                incident_number="INC-000001",
                title="Duplicate Number",
                reporter=self.user,
            )
