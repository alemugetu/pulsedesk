from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


def _add_member(user, org, role_slug):
    role = Role.objects.get(organization=org, slug=role_slug, is_system_role=True)
    return Membership.objects.create(
        user=user, organization=org, role=role, status=MembershipStatus.ACTIVE
    )


class CanViewDashboardPermissionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="perm@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Perm Org"
        )
        self.membership = self.user.memberships.get(organization=self.org)

    def test_owner_has_incident_view_permission(self):
        from organizations.selectors import user_has_permission

        self.assertTrue(user_has_permission(self.user, self.org, "incident.view"))

    def test_agent_has_incident_view_permission(self):
        agent_user = User.objects.create_user(
            email="agent@perm.test", password="Password123!"
        )
        _add_member(agent_user, self.org, "agent")
        from organizations.selectors import user_has_permission

        self.assertTrue(user_has_permission(agent_user, self.org, "incident.view"))

    def test_viewer_has_incident_view_permission(self):
        viewer_user = User.objects.create_user(
            email="viewer@perm.test", password="Password123!"
        )
        _add_member(viewer_user, self.org, "viewer")
        from organizations.selectors import user_has_permission

        self.assertTrue(user_has_permission(viewer_user, self.org, "incident.view"))


class DashboardPermissionAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@perm.test", password="Password123!"
        )
        self.no_member = User.objects.create_user(
            email="nomember@perm.test", password="Password123!"
        )

        self.org = OrganizationService.create_organization(
            user=self.owner, name="Perm Org"
        )
        self.viewer_user = User.objects.create_user(
            email="viewer@perm.test", password="Password123!"
        )
        _add_member(self.viewer_user, self.org, "viewer")

        self.summary_url = f"/api/v1/organizations/{self.org.id}/dashboard/summary/"
        self.sla_url = f"/api/v1/organizations/{self.org.id}/dashboard/sla-metrics/"
        self.escalation_url = (
            f"/api/v1/organizations/{self.org.id}/dashboard/escalation-metrics/"
        )
        self.priority_url = (
            f"/api/v1/organizations/{self.org.id}/dashboard/priority-distribution/"
        )
        self.incidents_url = f"/api/v1/organizations/{self.org.id}/dashboard/incidents/"

    def test_unauthenticated_denied(self):
        for url in [
            self.summary_url,
            self.sla_url,
            self.escalation_url,
            self.priority_url,
            self.incidents_url,
        ]:
            res = self.client.get(url)
            self.assertEqual(
                res.status_code, status.HTTP_401_UNAUTHORIZED, msg=f"Failed for {url}"
            )

    def test_non_member_denied(self):
        self.client.force_authenticate(user=self.no_member)
        for url in [
            self.summary_url,
            self.sla_url,
            self.escalation_url,
            self.priority_url,
            self.incidents_url,
        ]:
            res = self.client.get(url)
            self.assertEqual(
                res.status_code, status.HTTP_404_NOT_FOUND, msg=f"Failed for {url}"
            )

    def test_owner_can_access_all_endpoints(self):
        self.client.force_authenticate(user=self.owner)
        expected = {
            self.summary_url: status.HTTP_200_OK,
            self.sla_url: status.HTTP_200_OK,
            self.escalation_url: status.HTTP_200_OK,
            self.priority_url: status.HTTP_200_OK,
            self.incidents_url: status.HTTP_200_OK,
        }
        for url, code in expected.items():
            res = self.client.get(url)
            self.assertEqual(
                res.status_code, code, msg=f"Failed for {url}: got {res.status_code}"
            )

    def test_viewer_can_access_all_endpoints(self):
        self.client.force_authenticate(user=self.viewer_user)
        expected = {
            self.summary_url: status.HTTP_200_OK,
            self.sla_url: status.HTTP_200_OK,
            self.escalation_url: status.HTTP_200_OK,
            self.priority_url: status.HTTP_200_OK,
            self.incidents_url: status.HTTP_200_OK,
        }
        for url, code in expected.items():
            res = self.client.get(url)
            self.assertEqual(
                res.status_code, code, msg=f"Failed for {url}: got {res.status_code}"
            )

    def test_cross_tenant_returns_404(self):
        other_user = User.objects.create_user(
            email="other@perm.test", password="Password123!"
        )
        other_org = OrganizationService.create_organization(
            user=other_user, name="Other Perm Org"
        )

        self.client.force_authenticate(user=other_user)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        owner_client = self.client_class()
        owner_client.force_authenticate(user=self.owner)
        other_summary_url = f"/api/v1/organizations/{other_org.id}/dashboard/summary/"
        res2 = owner_client.get(other_summary_url)
        self.assertEqual(res2.status_code, status.HTTP_404_NOT_FOUND)
