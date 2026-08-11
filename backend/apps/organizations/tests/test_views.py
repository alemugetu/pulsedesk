import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import (
    Membership,
    MembershipStatus,
    OrganizationStatus,
)
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class OrganizationAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(
            email="usera@example.com",
            password="testpass123",
        )
        self.user_b = User.objects.create_user(
            email="userb@example.com",
            password="testpass123",
        )
        self.org_a = OrganizationService.create_organization(
            user=self.user_a,
            name="Organization A",
            slug="organization-a",
        )
        self.org_b = OrganizationService.create_organization(
            user=self.user_b,
            name="Organization B",
            slug="organization-b",
        )

    def _auth_as(self, user):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "testpass123"},
            format="json",
        )
        token = response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_create_organization(self):
        self._auth_as(self.user_a)
        response = self.client.post(
            "/api/v1/organizations/",
            {"name": "New Org"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "New Org")
        self.assertEqual(response.data["slug"], "new-org")

    def test_create_organization_requires_authentication(self):
        response = self.client.post(
            "/api/v1/organizations/",
            {"name": "New Org"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_my_organizations(self):
        self._auth_as(self.user_a)
        response = self.client.get("/api/v1/organizations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(self.org_a.id))

    def test_list_does_not_expose_other_tenant(self):
        self._auth_as(self.user_a)
        response = self.client.get("/api/v1/organizations/")
        organization_ids = {item["id"] for item in response.data}
        self.assertNotIn(str(self.org_b.id), organization_ids)

    def test_organization_detail_for_member(self):
        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Organization A")

    def test_organization_detail_cross_tenant_returns_404(self):
        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_organization_detail_unauthenticated(self):
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_organization_detail_invalid_uuid(self):
        self._auth_as(self.user_a)
        response = self.client.get("/api/v1/organizations/not-a-uuid/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_organization_detail_nonexistent_uuid(self):
        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{uuid.uuid4()}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_members_list_for_member(self):
        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user"]["email"], self.user_a.email)

    def test_members_list_cross_tenant_returns_404(self):
        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_b.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_members_list_unauthenticated(self):
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_query_parameter_manipulation_cannot_bypass_tenant(self):
        self._auth_as(self.user_a)
        response = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}/members/",
            {"organization_id": str(self.org_b.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        member_emails = {item["user"]["email"] for item in response.data}
        self.assertIn(self.user_a.email, member_emails)
        self.assertNotIn(self.user_b.email, member_emails)

    def test_suspended_membership_cannot_access_organization(self):
        membership = Membership.objects.get(user=self.user_a, organization=self.org_a)
        membership.status = MembershipStatus.SUSPENDED
        membership.save(update_fields=["status"])

        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_removed_membership_cannot_access_organization(self):
        membership = Membership.objects.get(user=self.user_a, organization=self.org_a)
        membership.status = MembershipStatus.REMOVED
        membership.save(update_fields=["status"])

        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_suspended_organization_cannot_be_accessed(self):
        self.org_a.status = OrganizationStatus.SUSPENDED
        self.org_a.save(update_fields=["status"])

        self._auth_as(self.user_a)
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_b_isolation(self):
        self._auth_as(self.user_b)
        response = self.client.get("/api/v1/organizations/")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(self.org_b.id))

        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_authenticated_user_without_membership_gets_404(self):
        outsider = User.objects.create_user(
            email="outsider@example.com",
            password="testpass123",
        )
        self._auth_as(outsider)
        response = self.client.get(f"/api/v1/organizations/{self.org_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
