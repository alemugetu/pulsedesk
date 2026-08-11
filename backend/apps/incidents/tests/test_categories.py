from django.contrib.auth import get_user_model
from incidents.services import CategoryService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentCategoryAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )
        self.client.force_authenticate(user=self.owner)

    def test_list_and_create_categories(self):
        url = f"/api/v1/organizations/{self.org.id}/incident-categories/"

        # Create
        response = self.client.post(
            url,
            {
                "name": "Database",
                "description": "Postgres and Redis issues",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Database")
        self.assertEqual(response.data["slug"], "database")

        # List
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_patch_category(self):
        category = CategoryService.create_category(
            organization=self.org, name="Network"
        )
        url = f"/api/v1/organizations/{self.org.id}/incident-categories/{category.id}/"

        response = self.client.patch(
            url,
            {"name": "Networking & DNS", "is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Networking & DNS")
        self.assertFalse(response.data["is_active"])
