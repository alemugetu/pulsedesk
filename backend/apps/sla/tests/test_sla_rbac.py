"""
Phase 6 — SLA RBAC Tests

Permission matrix under test:
  Owner            → sla.view + sla.manage
  Admin            → sla.view + sla.manage
  Operations Mgr   → sla.view only
  Agent            → sla.view only
  Viewer           → sla.view only

Unauthorized management (create/update) must return 400 (service-level
permission denied, raised as ValidationError) or 403.
"""

from django.contrib.auth import get_user_model
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase
from sla.services import SLAPolicyService

User = get_user_model()


def _setup_org_with_member(role_slug: str):
    """Return (owner, org, member_user, member_membership, policy_list_url)."""
    owner = User.objects.create_user(
        email=f"owner-{role_slug}@rbac-sla.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=owner, name=f"RBAC SLA Org {role_slug}"
    )
    member = User.objects.create_user(
        email=f"member-{role_slug}@rbac-sla.test", password="Password123!"
    )
    role = org.roles.get(slug=role_slug)
    membership = Membership.objects.create(
        user=member, organization=org, role=role, status=MembershipStatus.ACTIVE
    )
    list_url = f"/api/v1/organizations/{org.id}/sla-policies/"
    return owner, org, member, membership, list_url


class SLAManagePermissionTest(APITestCase):
    """Roles with sla.manage can create/update; others cannot."""

    def _can_create(self, role_slug: str) -> bool:
        _, _, member, _, list_url = _setup_org_with_member(role_slug)
        self.client.force_authenticate(user=member)
        res = self.client.post(
            list_url,
            {"name": f"Policy by {role_slug}", "is_active": True},
            format="json",
        )
        return res.status_code == status.HTTP_201_CREATED

    def test_owner_can_manage_sla(self):
        owner = User.objects.create_user(
            email="owner-manage@rbac-sla.test", password="Password123!"
        )
        org = OrganizationService.create_organization(user=owner, name="Owner SLA Org")
        self.client.force_authenticate(user=owner)
        list_url = f"/api/v1/organizations/{org.id}/sla-policies/"
        res = self.client.post(
            list_url,
            {"name": "Owner Policy", "is_active": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_admin_can_manage_sla(self):
        self.assertTrue(self._can_create("organization-admin"))

    def test_operations_manager_cannot_manage_sla(self):
        self.assertFalse(self._can_create("operations-manager"))

    def test_agent_cannot_manage_sla(self):
        self.assertFalse(self._can_create("agent"))

    def test_viewer_cannot_manage_sla(self):
        self.assertFalse(self._can_create("viewer"))


class SLAViewPermissionTest(APITestCase):
    """All roles with sla.view can read SLA policies."""

    def _can_view(self, role_slug: str) -> bool:
        owner, org, member, _, list_url = _setup_org_with_member(role_slug)
        # Create a policy as owner first
        owner_membership = owner.memberships.get(organization=org)
        SLAPolicyService.create_sla_policy(
            organization=org,
            actor_membership=owner_membership,
            name="Viewable Policy",
        )
        self.client.force_authenticate(user=member)
        res = self.client.get(list_url)
        return res.status_code == status.HTTP_200_OK

    def test_owner_can_view(self):
        owner = User.objects.create_user(
            email="owner-view@rbac-sla.test", password="Password123!"
        )
        org = OrganizationService.create_organization(user=owner, name="Owner View Org")
        self.client.force_authenticate(user=owner)
        res = self.client.get(f"/api/v1/organizations/{org.id}/sla-policies/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_admin_can_view(self):
        self.assertTrue(self._can_view("organization-admin"))

    def test_operations_manager_can_view(self):
        self.assertTrue(self._can_view("operations-manager"))

    def test_agent_can_view(self):
        self.assertTrue(self._can_view("agent"))

    def test_viewer_can_view(self):
        self.assertTrue(self._can_view("viewer"))


class SLATargetManagePermissionTest(APITestCase):
    """Only roles with sla.manage can create SLA targets."""

    def _try_create_target(self, role_slug: str) -> int:
        owner, org, member, _, list_url = _setup_org_with_member(role_slug)
        owner_membership = owner.memberships.get(organization=org)
        policy = SLAPolicyService.create_sla_policy(
            organization=org,
            actor_membership=owner_membership,
            name="Test Policy",
        )
        self.client.force_authenticate(user=member)
        target_url = f"{list_url}{policy.id}/targets/"
        res = self.client.post(
            target_url,
            {
                "priority": "P1",
                "response_time_minutes": 15,
                "resolution_time_minutes": 60,
            },
            format="json",
        )
        return res.status_code

    def test_admin_can_create_target(self):
        self.assertEqual(
            self._try_create_target("organization-admin"),
            status.HTTP_201_CREATED,
        )

    def test_operations_manager_cannot_create_target(self):
        sc = self._try_create_target("operations-manager")
        self.assertIn(sc, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    def test_agent_cannot_create_target(self):
        sc = self._try_create_target("agent")
        self.assertIn(sc, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    def test_viewer_cannot_create_target(self):
        sc = self._try_create_target("viewer")
        self.assertIn(sc, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])
