from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Organization
from organizations.serializers import (
    OrganizationCreateSerializer,
    OrganizationSerializer,
)
from rest_framework.test import APIRequestFactory

User = get_user_model()


class OrganizationSerializerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="testpass123",
        )
        self.factory = APIRequestFactory()

    def test_create_organization_serializer(self):
        request = self.factory.post("/api/v1/organizations/")
        request.user = self.user
        serializer = OrganizationCreateSerializer(
            data={"name": "Acme Corp"},
            context={"request": request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        organization = serializer.save()
        self.assertEqual(organization.name, "Acme Corp")

    def test_create_organization_requires_name(self):
        request = self.factory.post("/api/v1/organizations/")
        request.user = self.user
        serializer = OrganizationCreateSerializer(
            data={"name": "   "},
            context={"request": request},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_organization_response_serializer(self):
        organization = Organization.objects.create(name="Acme Corp", slug="acme-corp")
        data = OrganizationSerializer(organization).data
        self.assertEqual(data["name"], "Acme Corp")
        self.assertEqual(data["slug"], "acme-corp")
        self.assertIn("status", data)
