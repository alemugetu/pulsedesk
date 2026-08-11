from django.contrib.auth import get_user_model
from incidents.services import CategoryService, IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class IncidentRetrievalTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )
        self.cat1 = CategoryService.create_category(self.org, "Infra")
        self.cat2 = CategoryService.create_category(self.org, "Apps")

        self.inc1 = IncidentService.create_incident(
            self.org,
            self.owner,
            "Incident 1",
            priority="P1",
            category_id=str(self.cat1.id),
        )
        self.inc2 = IncidentService.create_incident(
            self.org,
            self.owner,
            "Incident 2",
            priority="P3",
            category_id=str(self.cat2.id),
        )

        self.client.force_authenticate(user=self.owner)
        self.url = f"/api/v1/organizations/{self.org.id}/incidents/"

    def test_list_incidents(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Paginated response format
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)

    def test_filter_by_priority(self):
        response = self.client.get(f"{self.url}?priority=P1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Incident 1")

    def test_get_incident_detail(self):
        detail_url = f"{self.url}{self.inc1.id}/"
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["incident_number"], "INC-000001")
        self.assertEqual(response.data["title"], "Incident 1")
