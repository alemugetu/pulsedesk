from django.contrib.auth import get_user_model
from incidents.models import IncidentStatus
from incidents.services import IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentStatusTransitionTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )
        self.incident = IncidentService.create_incident(
            self.org, self.owner, "Payment Failure"
        )
        self.client.force_authenticate(user=self.owner)
        self.url = f"/api/v1/organizations/{self.org.id}/incidents/{self.incident.id}/"

    def test_valid_lifecycle_transitions(self):
        # 1. OPEN -> ACKNOWLEDGED
        res = self.client.patch(
            self.url, {"status": IncidentStatus.ACKNOWLEDGED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], IncidentStatus.ACKNOWLEDGED)
        self.assertIsNone(res.data["resolved_at"])

        # 2. ACKNOWLEDGED -> IN_PROGRESS
        res = self.client.patch(
            self.url, {"status": IncidentStatus.IN_PROGRESS}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], IncidentStatus.IN_PROGRESS)
        self.assertIsNone(res.data["resolved_at"])

        # 3. IN_PROGRESS -> RESOLVED
        res = self.client.patch(
            self.url, {"status": IncidentStatus.RESOLVED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], IncidentStatus.RESOLVED)
        self.assertIsNotNone(res.data["resolved_at"])

        # 4. RESOLVED -> CLOSED
        res = self.client.patch(
            self.url, {"status": IncidentStatus.CLOSED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], IncidentStatus.CLOSED)

    def test_invalid_transition_fails(self):
        # OPEN -> CLOSED directly is prohibited
        res = self.client.patch(
            self.url, {"status": IncidentStatus.CLOSED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", res.data)
