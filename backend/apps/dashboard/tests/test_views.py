from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from escalation.models import (
    EscalationStatus,
    EscalationTriggerType,
    IncidentEscalation,
)
from escalation.services import (
    EscalationPolicyService,
)
from incidents.models import IncidentStatus
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase
from sla.services import SLAPolicyService

User = get_user_model()


def _add_member(user, org, role_slug):
    role = Role.objects.get(organization=org, slug=role_slug, is_system_role=True)
    return Membership.objects.create(
        user=user, organization=org, role=role, status=MembershipStatus.ACTIVE
    )


class DashboardViewsTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.agent = User.objects.create_user(
            email="agent@example.com", password="Password123!"
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com", password="Password123!"
        )

        self.org = OrganizationService.create_organization(
            user=self.owner, name="Dashboard Org"
        )
        self.owner_membership = self.owner.memberships.get(organization=self.org)

        self.agent_membership = _add_member(self.agent, self.org, "agent")
        self.viewer_membership = _add_member(self.viewer, self.org, "viewer")

        self.summary_url = f"/api/v1/organizations/{self.org.id}/dashboard/summary/"
        self.priority_url = (
            f"/api/v1/organizations/{self.org.id}/dashboard/priority-distribution/"
        )
        self.sla_url = f"/api/v1/organizations/{self.org.id}/dashboard/sla-metrics/"
        self.escalation_url = (
            f"/api/v1/organizations/{self.org.id}/dashboard/escalation-metrics/"
        )
        self.incidents_url = f"/api/v1/organizations/{self.org.id}/dashboard/incidents/"

        self.sla_policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.owner_membership,
            name="Default SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=self.sla_policy,
            actor_membership=self.owner_membership,
            priority="P1",
            response_time_minutes=10,
            resolution_time_minutes=30,
        )
        SLAPolicyService.create_sla_target(
            policy=self.sla_policy,
            actor_membership=self.owner_membership,
            priority="P3",
            response_time_minutes=60,
            resolution_time_minutes=240,
        )

        self.esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.owner_membership,
            name="Default Escalation",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.esc_policy,
            actor_membership=self.owner_membership,
            level=1,
            name="L1",
            delay_minutes=0,
            target_type="ROLE",
            target_reference=str(self.owner_membership.role.id),
        )
        EscalationPolicyService.create_escalation_rule(
            policy=self.esc_policy,
            actor_membership=self.owner_membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )

    # ------------------------------------------------------------------
    # Access / authorization
    # ------------------------------------------------------------------
    def test_summary_access_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(self.summary_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_summary_access_agent(self):
        self.client.force_authenticate(user=self.agent)
        response = self.client.get(self.summary_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_summary_access_viewer(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(self.summary_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cross_tenant_access_denied(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        self.client.force_authenticate(user=other_user)
        response = self.client.get(self.summary_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Summary endpoint
    # ------------------------------------------------------------------
    def test_summary_response_shape(self):
        IncidentService.create_incident(
            self.org, self.owner, "Test Incident", priority="P3"
        )
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for key in [
            "open_incidents",
            "unassigned_incidents",
            "sla_at_risk",
            "sla_breached",
            "active_escalations",
        ]:
            self.assertIn(key, res.data, msg=f"Missing key '{key}' in summary response")
            self.assertIsInstance(res.data[key], int)

    def test_summary_counts_accurate(self):
        # 1) healthy, unassigned, open
        IncidentService.create_incident(
            self.org, self.owner, "Healthy Open", priority="P3"
        )

        # 2) assigned, breached, active escalation
        breached = IncidentService.create_incident(
            self.org, self.owner, "Breached", priority="P1"
        )
        IncidentService.assign_incident(
            breached, self.owner_membership, self.owner_membership
        )
        sla_b = breached.sla
        sla_b.response_deadline = timezone.now() - timedelta(minutes=1)
        sla_b.response_breached = True
        sla_b.save()
        IncidentEscalation.objects.create(
            incident=breached,
            policy=self.esc_policy,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            current_level=1,
            status=EscalationStatus.ACTIVE,
        )

        # 3) at risk (90% elapsed of 10min P1 response)
        risky = IncidentService.create_incident(
            self.org, self.owner, "Risky", priority="P1"
        )
        sla_r = risky.sla
        sla_r.created_at = timezone.now() - timedelta(minutes=9)
        sla_r.response_deadline = sla_r.created_at + timedelta(minutes=10)
        sla_r.resolution_deadline = sla_r.created_at + timedelta(minutes=30)
        sla_r.save()

        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["open_incidents"], 3)
        self.assertEqual(res.data["unassigned_incidents"], 2)
        self.assertEqual(res.data["sla_breached"], 1)
        self.assertEqual(res.data["sla_at_risk"], 1)
        self.assertEqual(res.data["active_escalations"], 1)

    # ------------------------------------------------------------------
    # Priority distribution
    # ------------------------------------------------------------------
    def test_priority_distribution_response(self):
        IncidentService.create_incident(self.org, self.owner, "P1a", priority="P1")
        IncidentService.create_incident(self.org, self.owner, "P1b", priority="P1")
        IncidentService.create_incident(self.org, self.owner, "P3a", priority="P3")
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.priority_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["critical"], 2)
        self.assertEqual(res.data["high"], 0)
        self.assertEqual(res.data["medium"], 1)
        self.assertEqual(res.data["low"], 0)

    def test_priority_distribution_empty(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.priority_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for k in ["low", "medium", "high", "critical"]:
            self.assertEqual(res.data[k], 0)

    # ------------------------------------------------------------------
    # SLA metrics endpoint
    # ------------------------------------------------------------------
    def test_sla_metrics_response(self):
        IncidentService.create_incident(self.org, self.owner, "SLA test", priority="P3")
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.sla_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for key in [
            "healthy",
            "approaching",
            "breached",
            "resolved_within_sla",
            "response_breaches",
            "resolution_breaches",
        ]:
            self.assertIn(key, res.data)

    # ------------------------------------------------------------------
    # Escalation metrics endpoint
    # ------------------------------------------------------------------
    def test_escalation_metrics_response(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.escalation_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for key in ["active", "completed", "cancelled", "by_level"]:
            self.assertIn(key, res.data)
        self.assertIsInstance(res.data["by_level"], dict)

    # ------------------------------------------------------------------
    # Incident list: filters
    # ------------------------------------------------------------------
    def _create_for_filters(self):
        inc_p1 = IncidentService.create_incident(
            self.org, self.owner, "P1-OPEN", priority="P1"
        )
        inc_p3 = IncidentService.create_incident(
            self.org, self.owner, "P3-OPEN", priority="P3"
        )
        inc_assigned = IncidentService.create_incident(
            self.org, self.owner, "ASSIGNED", priority="P3"
        )
        IncidentService.assign_incident(
            inc_assigned, self.owner_membership, self.agent_membership
        )
        inc_resolved = IncidentService.create_incident(
            self.org, self.owner, "RESOLVED", priority="P3"
        )
        IncidentService.transition_incident_status(
            inc_resolved, self.owner_membership, "ACKNOWLEDGED"
        )
        IncidentService.transition_incident_status(
            inc_resolved, self.owner_membership, "IN_PROGRESS"
        )
        IncidentService.transition_incident_status(
            inc_resolved, self.owner_membership, "RESOLVED"
        )

        inc_breached = IncidentService.create_incident(
            self.org, self.owner, "BREACHED", priority="P1"
        )
        sla_b = inc_breached.sla
        sla_b.response_deadline = timezone.now() - timedelta(minutes=1)
        sla_b.response_breached = True
        sla_b.save()
        IncidentEscalation.objects.create(
            incident=inc_breached,
            policy=self.esc_policy,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            current_level=1,
            status=EscalationStatus.ACTIVE,
        )
        return {
            "p1": inc_p1,
            "p3": inc_p3,
            "assigned": inc_assigned,
            "resolved": inc_resolved,
            "breached": inc_breached,
        }

    def test_filter_priority(self):
        self._create_for_filters()
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"{self.incidents_url}?priority=P1")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for item in res.data["results"]:
            self.assertEqual(item["priority"], "P1")
        self.assertGreaterEqual(res.data["count"], 1)

    def test_filter_status(self):
        self._create_for_filters()
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"{self.incidents_url}?status=RESOLVED")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for item in res.data["results"]:
            self.assertEqual(item["status"], IncidentStatus.RESOLVED)

    def test_filter_assignee_id(self):
        data = self._create_for_filters()
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(
            f"{self.incidents_url}?assignee_id={self.agent_membership.id}"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["id"], str(data["assigned"].id))

    def test_filter_sla_state_breached(self):
        self._create_for_filters()
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"{self.incidents_url}?sla_state=BREACHED")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for item in res.data["results"]:
            self.assertEqual(item["sla_state"], "BREACHED")
        self.assertGreaterEqual(len(res.data["results"]), 1)

    def test_filter_sla_state_healthy(self):
        self._create_for_filters()
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"{self.incidents_url}?sla_state=HEALTHY")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for item in res.data["results"]:
            self.assertIn(item["sla_state"], {"HEALTHY", "UNKNOWN"})

    def test_filter_escalation_state_active(self):
        self._create_for_filters()
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"{self.incidents_url}?escalation_state=ACTIVE")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for item in res.data["results"]:
            self.assertEqual(item["escalation_status"], EscalationStatus.ACTIVE)
        self.assertGreaterEqual(len(res.data["results"]), 1)

    # ------------------------------------------------------------------
    # Incident list: pagination & ordering
    # ------------------------------------------------------------------
    def test_incident_list_pagination_default_page_size(self):
        self.client.force_authenticate(user=self.owner)
        for i in range(3):
            IncidentService.create_incident(
                self.org, self.owner, f"I{i}", priority="P3"
            )
        res = self.client.get(self.incidents_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("count", res.data)
        self.assertIn("results", res.data)
        self.assertIn("next", res.data)
        self.assertIn("previous", res.data)
        self.assertEqual(res.data["count"], 3)
        self.assertEqual(len(res.data["results"]), 3)

    def test_incident_list_page_size_param(self):
        self.client.force_authenticate(user=self.owner)
        for i in range(10):
            IncidentService.create_incident(
                self.org, self.owner, f"Inc-{i}", priority="P3"
            )
        res = self.client.get(f"{self.incidents_url}?page_size=3")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 10)
        self.assertEqual(len(res.data["results"]), 3)

    def test_incident_list_page_number_param(self):
        self.client.force_authenticate(user=self.owner)
        ids = []
        for i in range(6):
            inc = IncidentService.create_incident(
                self.org, self.owner, f"Pg-{i}", priority="P3"
            )
            ids.append(str(inc.id))
        res_p1 = self.client.get(f"{self.incidents_url}?page_size=2&page=1")
        res_p2 = self.client.get(f"{self.incidents_url}?page_size=2&page=2")
        self.assertEqual(res_p1.status_code, status.HTTP_200_OK)
        self.assertEqual(res_p2.status_code, status.HTTP_200_OK)
        self.assertEqual(res_p1.data["count"], 6)
        self.assertEqual(res_p2.data["count"], 6)
        p1_ids = {r["id"] for r in res_p1.data["results"]}
        p2_ids = {r["id"] for r in res_p2.data["results"]}
        self.assertEqual(len(p1_ids & p2_ids), 0)

    def test_incident_list_ordering_ascending(self):
        self.client.force_authenticate(user=self.owner)
        for p in ["P4", "P1", "P3", "P2"]:
            IncidentService.create_incident(
                self.org, self.owner, f"Ord-{p}", priority=p
            )
        res = self.client.get(f"{self.incidents_url}?ordering=priority")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        priorities = [r["priority"] for r in res.data["results"]]
        self.assertEqual(priorities, sorted(priorities))

    def test_incident_list_ordering_descending(self):
        self.client.force_authenticate(user=self.owner)
        for p in ["P4", "P1", "P3", "P2"]:
            IncidentService.create_incident(
                self.org, self.owner, f"Ord-{p}", priority=p
            )
        res = self.client.get(f"{self.incidents_url}?ordering=-priority")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        priorities = [r["priority"] for r in res.data["results"]]
        self.assertEqual(priorities, sorted(priorities, reverse=True))
