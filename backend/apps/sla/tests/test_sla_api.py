"""
Phase 6 — SLA API Tests

Validates:
- CRUD on SLA policies via REST API.
- CRUD on SLA targets via REST API.
- SLA summary embedded in incident API responses.
- Unauthenticated requests return 401.
- Non-members return 404.
"""

from django.contrib.auth import get_user_model
from incidents.models import IncidentPriority
from incidents.services import IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase
from sla.services import SLAPolicyService

User = get_user_model()


class SLAPolicyAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@api.test", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="API Test Org"
        )
        self.membership = self.owner.memberships.get(organization=self.org)
        self.client.force_authenticate(user=self.owner)
        self.list_url = f"/api/v1/organizations/{self.org.id}/sla-policies/"

    def test_list_policies_empty(self):
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_create_policy(self):
        res = self.client.post(
            self.list_url,
            {"name": "Standard SLA", "is_active": True, "is_default": False},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Standard SLA")
        self.assertIn("id", res.data)
        self.assertIn("targets", res.data)

    def test_create_policy_missing_name(self):
        res = self.client.post(self.list_url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_policy_detail(self):
        policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Detail Policy",
        )
        res = self.client.get(f"{self.list_url}{policy.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Detail Policy")

    def test_patch_policy(self):
        policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Patch Me",
        )
        res = self.client.patch(
            f"{self.list_url}{policy.id}/",
            {"name": "Patched Name"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Patched Name")

    def test_policy_not_found_returns_404(self):
        import uuid

        fake_id = uuid.uuid4()
        res = self.client.get(f"{self.list_url}{fake_id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_member_returns_404(self):
        outsider = User.objects.create_user(
            email="outsider@api.test", password="Password123!"
        )
        self.client.force_authenticate(user=outsider)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_filter_by_active_status(self):
        SLAPolicyService.create_sla_policy(
            organization=self.org, actor_membership=self.membership, name="Active A"
        )
        p2 = SLAPolicyService.create_sla_policy(
            organization=self.org, actor_membership=self.membership, name="Inactive B"
        )
        SLAPolicyService.update_sla_policy(
            policy=p2, actor_membership=self.membership, is_active=False
        )
        res = self.client.get(self.list_url, {"is_active": "true"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [p["name"] for p in res.data]
        self.assertIn("Active A", names)
        self.assertNotIn("Inactive B", names)


class SLATargetAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@target-api.test", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Target API Org"
        )
        self.membership = self.owner.memberships.get(organization=self.org)
        self.client.force_authenticate(user=self.owner)
        self.policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Target Test Policy",
        )
        self.target_list_url = (
            f"/api/v1/organizations/{self.org.id}"
            f"/sla-policies/{self.policy.id}/targets/"
        )

    def test_list_targets_empty(self):
        res = self.client.get(self.target_list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_create_target(self):
        res = self.client.post(
            self.target_list_url,
            {
                "priority": "P1",
                "response_time_minutes": 15,
                "resolution_time_minutes": 60,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["priority"], "P1")
        self.assertEqual(res.data["response_time_minutes"], 15)
        self.assertEqual(res.data["resolution_time_minutes"], 60)

    def test_create_duplicate_priority_rejected(self):
        SLAPolicyService.create_sla_target(
            policy=self.policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )
        res = self.client.post(
            self.target_list_url,
            {
                "priority": "P1",
                "response_time_minutes": 20,
                "resolution_time_minutes": 90,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_priority(self):
        res = self.client.post(
            self.target_list_url,
            {
                "priority": "P9",
                "response_time_minutes": 15,
                "resolution_time_minutes": 60,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_target(self):
        target = SLAPolicyService.create_sla_target(
            policy=self.policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P2,
            response_time_minutes=30,
            resolution_time_minutes=240,
        )
        target_url = f"{self.target_list_url}{target.id}/"
        res = self.client.patch(
            target_url,
            {"response_time_minutes": 45},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["response_time_minutes"], 45)

    def test_get_target_detail(self):
        target = SLAPolicyService.create_sla_target(
            policy=self.policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P3,
            response_time_minutes=60,
            resolution_time_minutes=480,
        )
        res = self.client.get(f"{self.target_list_url}{target.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["priority"], "P3")


class IncidentSLASummaryAPITest(APITestCase):
    """Test that incident API responses include embedded SLA summary."""

    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@sla-summary.test", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="SLA Summary Org"
        )
        self.membership = self.owner.memberships.get(organization=self.org)
        self.client.force_authenticate(user=self.owner)

        # Create a default SLA policy with P1 target
        policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )

    def test_incident_response_includes_sla(self):
        incident = IncidentService.create_incident(
            self.org, self.owner, "With SLA", priority=IncidentPriority.P1
        )
        res = self.client.get(
            f"/api/v1/organizations/{self.org.id}/incidents/{incident.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("sla", res.data)
        sla = res.data["sla"]
        self.assertIsNotNone(sla)
        self.assertIn("policy", sla)
        self.assertIn("response_deadline", sla)
        self.assertIn("resolution_deadline", sla)
        self.assertIn("response_status", sla)
        self.assertIn("resolution_status", sla)
        self.assertEqual(sla["policy"], "Default SLA")
        self.assertEqual(sla["response_status"], "ON_TRACK")
        self.assertEqual(sla["resolution_status"], "ON_TRACK")

    def test_incident_without_sla_has_null_sla(self):
        """Incidents in an org without a default policy must have sla=null."""
        user2 = User.objects.create_user(
            email="no-policy@sla-summary.test", password="Password123!"
        )
        org2 = OrganizationService.create_organization(user=user2, name="No Policy Org")
        incident = IncidentService.create_incident(org2, user2, "No SLA Incident")
        self.client.force_authenticate(user=user2)
        res = self.client.get(
            f"/api/v1/organizations/{org2.id}/incidents/{incident.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data["sla"])
