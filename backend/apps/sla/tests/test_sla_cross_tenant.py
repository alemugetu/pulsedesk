"""
Phase 6 — SLA Cross-Tenant Security Tests

Validates every cross-tenant attack vector:
  - Org A user cannot read Org B SLA policies.
  - Org A user cannot create policy in Org B.
  - Org A user cannot access Org B policy detail.
  - Org A target cannot be attached to Org B policy.
  - Org B incident cannot use Org A SLA policy.
  - Policy URL belonging to another org returns 404 (not 403) to prevent enumeration.
"""

from django.contrib.auth import get_user_model
from incidents.models import IncidentPriority
from incidents.services import IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase
from sla.services import SLAPolicyService

User = get_user_model()


class SLACrossTenantTest(APITestCase):
    def setUp(self):
        # Org A
        self.user_a = User.objects.create_user(
            email="usera@cross.test", password="Password123!"
        )
        self.org_a = OrganizationService.create_organization(
            user=self.user_a, name="Org A Cross"
        )
        self.membership_a = self.user_a.memberships.get(organization=self.org_a)

        # Org B
        self.user_b = User.objects.create_user(
            email="userb@cross.test", password="Password123!"
        )
        self.org_b = OrganizationService.create_organization(
            user=self.user_b, name="Org B Cross"
        )
        self.membership_b = self.user_b.memberships.get(organization=self.org_b)

        # Policy A (belongs to Org A)
        self.policy_a = SLAPolicyService.create_sla_policy(
            organization=self.org_a,
            actor_membership=self.membership_a,
            name="Policy A",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=self.policy_a,
            actor_membership=self.membership_a,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )

        # Policy B (belongs to Org B)
        self.policy_b = SLAPolicyService.create_sla_policy(
            organization=self.org_b,
            actor_membership=self.membership_b,
            name="Policy B",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=self.policy_b,
            actor_membership=self.membership_b,
            priority=IncidentPriority.P1,
            response_time_minutes=30,
            resolution_time_minutes=120,
        )

    # ------------------------------------------------------------------
    # Policy list isolation
    # ------------------------------------------------------------------

    def test_user_a_cannot_list_org_b_policies(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(f"/api/v1/organizations/{self.org_b.id}/sla-policies/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_list_org_a_policies(self):
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get(f"/api/v1/organizations/{self.org_a.id}/sla-policies/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Policy detail isolation (IDOR prevention)
    # ------------------------------------------------------------------

    def test_user_a_cannot_access_policy_b_detail(self):
        """
        User A using Org B's organization_id with Policy B's UUID must get 404.
        Tests IDOR: even if user_a guesses policy_b's UUID, access is denied.
        """
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_b.id}/sla-policies/{self.policy_b.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_access_policy_a_detail(self):
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}/sla-policies/{self.policy_a.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_a_using_own_org_but_policy_b_uuid_gets_404(self):
        """
        User A authenticated to Org A, but supplying Policy B's UUID.
        The selector scopes by organization — must return 404.
        """
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}/sla-policies/{self.policy_b.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Policy create isolation
    # ------------------------------------------------------------------

    def test_user_a_cannot_create_policy_in_org_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post(
            f"/api/v1/organizations/{self.org_b.id}/sla-policies/",
            {"name": "Injected Policy", "is_active": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Policy update isolation
    # ------------------------------------------------------------------

    def test_user_a_cannot_update_policy_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.patch(
            f"/api/v1/organizations/{self.org_b.id}/sla-policies/{self.policy_b.id}/",
            {"name": "Hacked Name"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Target isolation
    # ------------------------------------------------------------------

    def test_user_a_cannot_list_targets_of_policy_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_b.id}"
            f"/sla-policies/{self.policy_b.id}/targets/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_a_cannot_create_target_in_policy_b(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post(
            f"/api/v1/organizations/{self.org_b.id}"
            f"/sla-policies/{self.policy_b.id}/targets/",
            {
                "priority": "P2",
                "response_time_minutes": 30,
                "resolution_time_minutes": 240,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_target_service_rejected(self):
        """
        Service-level: User A's membership cannot create target for Policy B.
        """
        from sla.services import SLAValidationError

        with self.assertRaises(SLAValidationError) as ctx:
            SLAPolicyService.create_sla_target(
                policy=self.policy_b,  # Org B's policy
                actor_membership=self.membership_a,  # Org A's membership
                priority=IncidentPriority.P2,
                response_time_minutes=30,
                resolution_time_minutes=240,
            )
        self.assertEqual(ctx.exception.code, "cross_tenant")

    def test_cross_tenant_update_target_service_rejected(self):
        """
        Service-level: User A's membership cannot update a target belonging to Policy B.
        """
        from sla.services import SLAValidationError

        target_b = self.policy_b.targets.get(priority=IncidentPriority.P1)
        with self.assertRaises(SLAValidationError) as ctx:
            SLAPolicyService.update_sla_target(
                target=target_b,
                actor_membership=self.membership_a,  # wrong org
                response_time_minutes=99,
            )
        self.assertEqual(ctx.exception.code, "cross_tenant")

    # ------------------------------------------------------------------
    # Incident SLA isolation
    # ------------------------------------------------------------------

    def test_incident_in_org_a_uses_policy_a_not_policy_b(self):
        """
        An incident created in Org A must be linked to Org A's SLA policy,
        never to Org B's policy.
        """
        incident_a = IncidentService.create_incident(
            self.org_a, self.user_a, "Org A Incident", priority=IncidentPriority.P1
        )
        from sla.selectors import get_incident_sla

        sla = get_incident_sla(incident_a)
        self.assertIsNotNone(sla)
        self.assertEqual(sla.policy.organization_id, self.org_a.id)
        self.assertNotEqual(sla.policy.id, self.policy_b.id)

    def test_incident_in_org_b_uses_policy_b_not_policy_a(self):
        incident_b = IncidentService.create_incident(
            self.org_b, self.user_b, "Org B Incident", priority=IncidentPriority.P1
        )
        from sla.selectors import get_incident_sla

        sla = get_incident_sla(incident_b)
        self.assertIsNotNone(sla)
        self.assertEqual(sla.policy.organization_id, self.org_b.id)
        self.assertNotEqual(sla.policy.id, self.policy_a.id)

    def test_org_a_incident_sla_inaccessible_to_user_b(self):
        """
        User B cannot read an incident belonging to Org A — returns 404.
        """
        incident_a = IncidentService.create_incident(
            self.org_a, self.user_a, "Private Incident", priority=IncidentPriority.P1
        )
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get(
            f"/api/v1/organizations/{self.org_a.id}/incidents/{incident_a.id}/"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
