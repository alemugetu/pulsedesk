from django.contrib.auth import get_user_model
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentAssignmentTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.agent_user = User.objects.create_user(
            email="agent@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )
        # Add agent member
        agent_role = Role.objects.get(
            organization=self.org, slug="agent", is_system_role=True
        )
        self.agent_membership = Membership.objects.create(
            user=self.agent_user,
            organization=self.org,
            role=agent_role,
            status=MembershipStatus.ACTIVE,
        )

        self.incident = IncidentService.create_incident(
            self.org, self.owner, "Server Outage"
        )
        self.url = f"/api/v1/organizations/{self.org.id}/incidents/{self.incident.id}/"

    def test_owner_assigns_incident_to_agent(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            self.url,
            {"assignee_id": str(self.agent_membership.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["assignee"])
        self.assertEqual(response.data["assignee"]["id"], str(self.agent_membership.id))
        self.assertEqual(
            response.data["assignee"]["user"]["email"], "agent@example.com"
        )

    def test_agent_cannot_assign_incident(self):
        self.client.force_authenticate(user=self.agent_user)
        response = self.client.patch(
            self.url,
            {"assignee_id": str(self.agent_membership.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
