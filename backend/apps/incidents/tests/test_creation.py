from django.contrib.auth import get_user_model
from incidents.services import CategoryService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentCreationTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )
        self.category = CategoryService.create_category(
            organization=self.org, name="Security"
        )
        self.url = f"/api/v1/organizations/{self.org.id}/incidents/"

    def test_unauthenticated_creation_fails(self):
        response = self.client.post(
            self.url,
            {"title": "Unauthorized attempt"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_creation_succeeds(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            self.url,
            {
                "title": "Suspicious login activity",
                "description": "Multiple failed attempts from unknown IP",
                "priority": "P2",
                "category_id": str(self.category.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["incident_number"], "INC-000001")
        self.assertEqual(response.data["title"], "Suspicious login activity")
        self.assertEqual(response.data["status"], "OPEN")
        self.assertEqual(response.data["priority"], "P2")
        self.assertEqual(response.data["reporter"]["email"], "owner@example.com")
        self.assertEqual(response.data["category"]["id"], str(self.category.id))

    def test_creation_with_empty_title_fails(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            self.url,
            {"title": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
