from django.contrib.auth import get_user_model
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentRBACTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.admin = User.objects.create_user(
            email="admin@example.com", password="Password123!"
        )
        self.ops = User.objects.create_user(
            email="ops@example.com", password="Password123!"
        )
        self.agent = User.objects.create_user(
            email="agent@example.com", password="Password123!"
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com", password="Password123!"
        )

        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )

        self.add_member(self.admin, "organization-admin")
        self.add_member(self.ops, "operations-manager")
        self.add_member(self.agent, "agent")
        self.add_member(self.viewer, "viewer")

        self.url = f"/api/v1/organizations/{self.org.id}/incidents/"

    def add_member(self, user, role_slug):
        role = Role.objects.get(
            organization=self.org, slug=role_slug, is_system_role=True
        )
        Membership.objects.create(
            user=user,
            organization=self.org,
            role=role,
            status=MembershipStatus.ACTIVE,
        )

    def test_viewer_can_view_but_cannot_create(self):
        self.client.force_authenticate(user=self.viewer)
        res_get = self.client.get(self.url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)

        res_post = self.client.post(
            self.url, {"title": "Viewer Incident"}, format="json"
        )
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_agent_can_create_and_update_but_cannot_assign(self):
        self.client.force_authenticate(user=self.agent)
        res_post = self.client.post(
            self.url, {"title": "Agent Incident"}, format="json"
        )
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        inc_id = res_post.data["id"]

        detail_url = f"{self.url}{inc_id}/"
        res_update = self.client.patch(
            detail_url, {"title": "Updated Agent Incident"}, format="json"
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)

        # Agent trying to assign should fail
        ops_membership = Membership.objects.get(user=self.ops, organization=self.org)
        res_assign = self.client.patch(
            detail_url, {"assignee_id": str(ops_membership.id)}, format="json"
        )
        self.assertEqual(res_assign.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ops_manager_can_assign_and_resolve(self):
        inc = IncidentService.create_incident(self.org, self.owner, "Ops Incident")
        detail_url = f"{self.url}{inc.id}/"

        self.client.force_authenticate(user=self.ops)
        ops_membership = Membership.objects.get(user=self.ops, organization=self.org)

        # Assign
        res_assign = self.client.patch(
            detail_url, {"assignee_id": str(ops_membership.id)}, format="json"
        )
        self.assertEqual(res_assign.status_code, status.HTTP_200_OK)
