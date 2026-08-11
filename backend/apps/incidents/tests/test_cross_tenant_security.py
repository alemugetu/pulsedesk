from django.contrib.auth import get_user_model
from incidents.services import CategoryService, IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentCrossTenantSecurityTest(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            email="usera@example.com", password="Password123!"
        )
        self.user_b = User.objects.create_user(
            email="userb@example.com", password="Password123!"
        )

        self.org_a = OrganizationService.create_organization(self.user_a, "Org A")
        self.org_b = OrganizationService.create_organization(self.user_b, "Org B")

        self.category_a = CategoryService.create_category(self.org_a, "Org A Category")
        self.category_b = CategoryService.create_category(self.org_b, "Org B Category")

        self.incident_a = IncidentService.create_incident(
            self.org_a, self.user_a, "Org A Incident"
        )
        self.incident_b = IncidentService.create_incident(
            self.org_b, self.user_b, "Org B Incident"
        )

    def test_user_a_cannot_view_org_b_incidents(self):
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/v1/organizations/{self.org_b.id}/incidents/"
        response = self.client.get(url)
        # IsOrganizationMember returns 404 for cross-tenant access to prevent org enumeration
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_a_cannot_access_org_b_incident_detail(self):
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/v1/organizations/{self.org_b.id}/incidents/{self.incident_b.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_category_assignment_rejected(self):
        self.client.force_authenticate(user=self.user_a)
        url = f"/api/v1/organizations/{self.org_a.id}/incidents/"
        response = self.client.post(
            url,
            {
                "title": "Cross tenant category attack",
                "category_id": str(self.category_b.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_cross_tenant_assignee_assignment_rejected(self):
        self.client.force_authenticate(user=self.user_a)
        # User B's membership in Org B
        membership_b = self.user_b.memberships.get(organization=self.org_b)

        url = f"/api/v1/organizations/{self.org_a.id}/incidents/"
        response = self.client.post(
            url,
            {
                "title": "Cross tenant assignee attack",
                "assignee_id": str(membership_b.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assignee", response.data)
