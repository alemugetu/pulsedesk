"""
Phase 7 — Escalation RBAC Tests

Permission matrix under test:
  Owner              → escalation.view + escalation.manage + escalation.evaluate
  Admin              → escalation.view + escalation.manage + escalation.evaluate
  Operations Manager → escalation.view + escalation.manage + escalation.evaluate
  Agent              → escalation.view only
  Viewer             → escalation.view only

Management (create/update policy) must return 400/403 for Agent and Viewer.
Evaluation must return 403 for Agent and Viewer.
"""

from django.contrib.auth import get_user_model
from escalation.services import EscalationPolicyService
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


def _setup_org_with_member(role_slug: str):
    """Return (owner, org, member_user, member_membership, policy_list_url)."""
    owner = User.objects.create_user(
        email=f"owner-{role_slug}@rbac-esc.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=owner, name=f"RBAC Esc Org {role_slug}"
    )
    member = User.objects.create_user(
        email=f"member-{role_slug}@rbac-esc.test", password="Password123!"
    )
    role = org.roles.get(slug=role_slug)
    membership = Membership.objects.create(
        user=member, organization=org, role=role, status=MembershipStatus.ACTIVE
    )
    list_url = f"/api/v1/organizations/{org.id}/escalation-policies/"
    return owner, org, member, membership, list_url


class EscalationManagePermissionTest(APITestCase):
    """Roles with escalation.manage can create/update; Agent and Viewer cannot."""

    def _can_create(self, role_slug: str) -> bool:
        _, _, member, _, list_url = _setup_org_with_member(role_slug)
        self.client.force_authenticate(user=member)
        res = self.client.post(
            list_url,
            {"name": f"Policy by {role_slug}", "is_active": True},
            format="json",
        )
        return res.status_code == status.HTTP_201_CREATED

    def test_owner_can_manage(self):
        owner = User.objects.create_user(
            email="owner-manage@rbac-esc.test", password="Password123!"
        )
        org = OrganizationService.create_organization(user=owner, name="Owner Esc Org")
        self.client.force_authenticate(user=owner)
        list_url = f"/api/v1/organizations/{org.id}/escalation-policies/"
        res = self.client.post(
            list_url,
            {"name": "Owner Policy", "is_active": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_admin_can_manage(self):
        self.assertTrue(self._can_create("organization-admin"))

    def test_operations_manager_can_manage(self):
        self.assertTrue(self._can_create("operations-manager"))

    def test_agent_cannot_manage(self):
        self.assertFalse(self._can_create("agent"))

    def test_viewer_cannot_manage(self):
        self.assertFalse(self._can_create("viewer"))


class EscalationViewPermissionTest(APITestCase):
    """All roles with escalation.view can read policies."""

    def _can_view(self, role_slug: str) -> bool:
        owner, org, member, _, list_url = _setup_org_with_member(role_slug)
        owner_membership = owner.memberships.get(organization=org)
        EscalationPolicyService.create_escalation_policy(
            organization=org,
            actor_membership=owner_membership,
            name="Viewable Policy",
        )
        self.client.force_authenticate(user=member)
        res = self.client.get(list_url)
        return res.status_code == status.HTTP_200_OK

    def test_owner_can_view(self):
        owner = User.objects.create_user(
            email="owner-view@rbac-esc.test", password="Password123!"
        )
        org = OrganizationService.create_organization(user=owner, name="View Esc Org")
        self.client.force_authenticate(user=owner)
        res = self.client.get(f"/api/v1/organizations/{org.id}/escalation-policies/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_admin_can_view(self):
        self.assertTrue(self._can_view("organization-admin"))

    def test_operations_manager_can_view(self):
        self.assertTrue(self._can_view("operations-manager"))

    def test_agent_can_view(self):
        self.assertTrue(self._can_view("agent"))

    def test_viewer_can_view(self):
        self.assertTrue(self._can_view("viewer"))


class EscalationEvaluatePermissionTest(APITestCase):
    """Only Owner, Admin, and Ops Manager can call the evaluate endpoint."""

    def _can_evaluate(self, role_slug: str) -> int:
        from escalation.models import EscalationTriggerType
        from incidents.models import IncidentPriority
        from incidents.services import IncidentService
        from sla.services import SLAPolicyService

        owner, org, member, _, _ = _setup_org_with_member(role_slug)
        owner_membership = owner.memberships.get(organization=org)

        # Setup SLA + escalation policy
        sla_policy = SLAPolicyService.create_sla_policy(
            organization=org,
            actor_membership=owner_membership,
            name="SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=sla_policy,
            actor_membership=owner_membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )
        esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=org,
            actor_membership=owner_membership,
            name="Esc Policy",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=esc_policy,
            actor_membership=owner_membership,
            level=1,
            name="L1",
            delay_minutes=0,
            target_type="ASSIGNEE",
        )
        EscalationPolicyService.create_escalation_rule(
            policy=esc_policy,
            actor_membership=owner_membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )

        incident = IncidentService.create_incident(org, owner, "Eval Test")
        eval_url = (
            f"/api/v1/organizations/{org.id}"
            f"/incidents/{incident.id}/escalations/evaluate/"
        )
        self.client.force_authenticate(user=member)
        res = self.client.post(
            eval_url, {"trigger_type": "RESPONSE_BREACH"}, format="json"
        )
        return res.status_code

    def test_owner_can_evaluate(self):
        owner = User.objects.create_user(
            email="owner-eval@rbac-esc.test", password="Password123!"
        )
        from incidents.services import IncidentService

        org = OrganizationService.create_organization(user=owner, name="Eval Org Owner")
        incident = IncidentService.create_incident(org, owner, "Eval")
        eval_url = (
            f"/api/v1/organizations/{org.id}"
            f"/incidents/{incident.id}/escalations/evaluate/"
        )
        self.client.force_authenticate(user=owner)
        res = self.client.post(
            eval_url, {"trigger_type": "RESPONSE_BREACH"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_admin_can_evaluate(self):
        self.assertEqual(self._can_evaluate("organization-admin"), status.HTTP_200_OK)

    def test_operations_manager_can_evaluate(self):
        self.assertEqual(self._can_evaluate("operations-manager"), status.HTTP_200_OK)

    def test_agent_cannot_evaluate(self):
        self.assertEqual(self._can_evaluate("agent"), status.HTTP_403_FORBIDDEN)

    def test_viewer_cannot_evaluate(self):
        self.assertEqual(self._can_evaluate("viewer"), status.HTTP_403_FORBIDDEN)
