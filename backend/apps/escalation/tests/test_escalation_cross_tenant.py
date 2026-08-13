"""
Phase 7 — Escalation Cross-Tenant Security Tests

Validates:
- Org A user cannot list/read/create/update Org B policies (404 or service-level error).
- Org A user cannot access Org B escalation history.
- ROLE target from Org B cannot be used in Org A policy.
- Evaluate endpoint scoped to incident org — outsider gets 404.
- Policy UUID from another org returns 404 when accessed via own org URL.
"""

from django.contrib.auth import get_user_model
from escalation.models import EscalationTargetType
from escalation.services import EscalationPolicyService, EscalationValidationError
from incidents.models import IncidentPriority
from incidents.services import IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class EscalationCrossTenantTest(APITestCase):
    def setUp(self):
        # Org A
        self.user_a = User.objects.create_user(
            email="usera@cross-esc.test", password="Password123!"
        )
        self.org_a = OrganizationService.create_organization(
            user=self.user_a, name="Esc Org A"
        )
        self.membership_a = self.user_a.memberships.get(organization=self.org_a)

        # Org B
        self.user_b = User.objects.create_user(
            email="userb@cross-esc.test", password="Password123!"
        )
        self.org_b = OrganizationService.create_organization(
            user=self.user_b, name="Esc Org B"
        )
        self.membership_b = self.user_b.memberships.get(organization=self.org_b)

        # Policy A
        self.policy_a = EscalationPolicyService.create_escalation_policy(
            organization=self.org_a,
            actor_membership=self.membership_a,
            name="Policy A",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.policy_a,
            actor_membership=self.membership_a,
            level=1,
            name="L1",
            delay_minutes=0,
            target_type="ASSIGNEE",
        )

        # Policy B
        self.policy_b = EscalationPolicyService.create_escalation_policy(
            organization=self.org_b,
            actor_membership=self.membership_b,
            name="Policy B",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.policy_b,
            actor_membership=self.membership_b,
            level=1,
            name="L1 B",
            delay_minutes=0,
            target_type="ASSIGNEE",
        )

    # ---------------------------------------------------------------
    # Policy list isolation
    # ---------------------------------------------------------------

    def test_user_a_cannot_list_org_b_policies(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_b.id}/escalation-policies/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_list_org_a_policies(self):
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}/escalation-policies/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------------------------------------------------------
    # Policy detail isolation (IDOR prevention)
    # ---------------------------------------------------------------

    def test_user_a_cannot_access_policy_b_detail(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_b.id}/escalation-policies/{self.policy_b.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_a_using_own_org_but_policy_b_uuid_returns_404(self):
        """IDOR: user A authenticates to org A, but supplies policy B UUID."""
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}/escalation-policies/{self.policy_b.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------------------------------------------------------
    # Policy create isolation
    # ---------------------------------------------------------------

    def test_user_a_cannot_create_policy_in_org_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post(
            f"/api/v1/organizations/{self.org_b.id}/escalation-policies/",
            {"name": "Injected Policy"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------------------------------------------------------
    # Policy update isolation
    # ---------------------------------------------------------------

    def test_user_a_cannot_update_policy_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.patch(
            f"/api/v1/organizations/{self.org_b.id}/escalation-policies/{self.policy_b.id}/",
            {"name": "Hacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------------------------------------------------------
    # Level isolation
    # ---------------------------------------------------------------

    def test_user_a_cannot_list_levels_of_policy_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_b.id}"
            f"/escalation-policies/{self.policy_b.id}/levels/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_a_cannot_create_level_in_policy_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post(
            f"/api/v1/organizations/{self.org_b.id}"
            f"/escalation-policies/{self.policy_b.id}/levels/",
            {"level": 2, "name": "L2", "delay_minutes": 10, "target_type": "ASSIGNEE"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------------------------------------------------------
    # Role target cross-tenant protection
    # ---------------------------------------------------------------

    def test_cross_tenant_role_target_service_rejected(self):
        """
        Service-level: User A's membership cannot set a role from Org B
        as the target for a level in Org A's policy.
        """
        role_b = self.org_b.roles.get(slug="agent")
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy_a,
                actor_membership=self.membership_a,
                level=2,
                name="Cross Tenant Role Level",
                delay_minutes=0,
                target_type=EscalationTargetType.ROLE,
                target_reference=str(role_b.id),
            )
        self.assertEqual(ctx.exception.code, "invalid_role_reference")

    def test_cross_tenant_level_creation_service_rejected(self):
        """
        Service-level: User B cannot create levels in Org A's policy.
        """
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy_a,
                actor_membership=self.membership_b,
                level=2,
                name="Cross Tenant Level",
                delay_minutes=0,
                target_type="ASSIGNEE",
            )
        self.assertEqual(ctx.exception.code, "cross_tenant")

    # ---------------------------------------------------------------
    # Incident escalation history isolation
    # ---------------------------------------------------------------

    def test_org_a_escalation_history_inaccessible_to_user_b(self):
        """User B cannot read escalation history for Org A's incident."""
        incident_a = IncidentService.create_incident(
            self.org_a, self.user_a, "Private Incident", priority=IncidentPriority.P1
        )
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}"
            f"/incidents/{incident_a.id}/escalations/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ---------------------------------------------------------------
    # Evaluate endpoint cross-tenant
    # ---------------------------------------------------------------

    def test_user_b_cannot_evaluate_org_a_incident(self):
        incident_a = IncidentService.create_incident(
            self.org_a, self.user_a, "Eval Incident", priority=IncidentPriority.P1
        )
        self.client.force_authenticate(user=self.user_b)
        res = self.client.post(
            f"/api/v1/organizations/{self.org_a.id}"
            f"/incidents/{incident_a.id}/escalations/evaluate/",
            {"trigger_type": "RESPONSE_BREACH"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
