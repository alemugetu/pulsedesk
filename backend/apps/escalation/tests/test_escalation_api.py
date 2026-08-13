"""
Phase 7 — Escalation API Tests

Validates:
- CRUD on escalation policies via REST API.
- CRUD on escalation levels via REST API.
- CRUD on escalation rules via REST API.
- Incident escalation history endpoint (read-only).
- Escalation evaluate endpoint.
- Unauthenticated requests return 401.
- Non-members return 404.
- Policy-not-found returns 404.
"""

from datetime import timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from escalation.models import EscalationTriggerType
from escalation.services import EscalationPolicyService
from incidents.models import IncidentPriority
from incidents.services import IncidentService
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase
from sla.services import SLACalculationService, SLAPolicyService

User = get_user_model()

FROZEN_NOW = timezone.datetime(2026, 1, 15, 10, 0, 0, tzinfo=dt_timezone.utc)


def _setup_org(email_prefix: str):
    user = User.objects.create_user(
        email=f"{email_prefix}@api.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=user, name=f"API Org {email_prefix}"
    )
    membership = user.memberships.get(organization=org)
    return user, org, membership


class EscalationPolicyAPITest(APITestCase):
    def setUp(self):
        self.user, self.org, self.membership = _setup_org("policy-api")
        self.client.force_authenticate(user=self.user)
        self.list_url = f"/api/v1/organizations/{self.org.id}/escalation-policies/"

    def test_list_policies_empty(self):
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_create_policy(self):
        res = self.client.post(
            self.list_url,
            {"name": "Critical Escalation", "is_active": True, "is_default": False},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Critical Escalation")
        self.assertIn("id", res.data)
        self.assertIn("levels", res.data)
        self.assertIn("rules", res.data)

    def test_create_policy_missing_name(self):
        res = self.client.post(self.list_url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_policy_detail(self):
        policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Detail Policy",
        )
        res = self.client.get(f"{self.list_url}{policy.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Detail Policy")

    def test_patch_policy(self):
        policy = EscalationPolicyService.create_escalation_policy(
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
        EscalationPolicyService.create_escalation_policy(
            organization=self.org, actor_membership=self.membership, name="Active A"
        )
        p2 = EscalationPolicyService.create_escalation_policy(
            organization=self.org, actor_membership=self.membership, name="Inactive B"
        )
        EscalationPolicyService.update_escalation_policy(
            policy=p2, actor_membership=self.membership, is_active=False
        )
        res = self.client.get(self.list_url, {"is_active": "true"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [p["name"] for p in res.data]
        self.assertIn("Active A", names)
        self.assertNotIn("Inactive B", names)


class EscalationLevelAPITest(APITestCase):
    def setUp(self):
        self.user, self.org, self.membership = _setup_org("level-api")
        self.client.force_authenticate(user=self.user)
        self.policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Level Test Policy",
        )
        self.level_url = (
            f"/api/v1/organizations/{self.org.id}"
            f"/escalation-policies/{self.policy.id}/levels/"
        )

    def test_list_levels_empty(self):
        res = self.client.get(self.level_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_create_assignee_level(self):
        res = self.client.post(
            self.level_url,
            {
                "level": 1,
                "name": "Assignee Level",
                "delay_minutes": 0,
                "target_type": "ASSIGNEE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["level"], 1)
        self.assertEqual(res.data["target_type"], "ASSIGNEE")
        self.assertEqual(res.data["delay_minutes"], 0)

    def test_create_role_level(self):
        role = self.org.roles.get(slug="operations-manager")
        res = self.client.post(
            self.level_url,
            {
                "level": 1,
                "name": "Ops Manager Level",
                "delay_minutes": 15,
                "target_type": "ROLE",
                "target_reference": str(role.id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["target_type"], "ROLE")
        self.assertEqual(res.data["target_reference"], str(role.id))

    def test_duplicate_level_number_returns_400(self):
        self.client.post(
            self.level_url,
            {
                "level": 1,
                "name": "Level 1",
                "delay_minutes": 0,
                "target_type": "ASSIGNEE",
            },
            format="json",
        )
        res = self.client.post(
            self.level_url,
            {
                "level": 1,
                "name": "Level 1 Dup",
                "delay_minutes": 0,
                "target_type": "ASSIGNEE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_target_type_returns_400(self):
        res = self.client.post(
            self.level_url,
            {"level": 1, "name": "Bad", "delay_minutes": 0, "target_type": "INVALID"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_level(self):
        EscalationPolicyService.create_escalation_level(
            policy=self.policy,
            actor_membership=self.membership,
            level=1,
            name="Original",
            delay_minutes=0,
            target_type="ASSIGNEE",
        )
        lvl = self.policy.levels.get(level=1)
        res = self.client.patch(
            f"{self.level_url}{lvl.id}/",
            {"name": "Updated Name", "delay_minutes": 10},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Updated Name")
        self.assertEqual(res.data["delay_minutes"], 10)

    def test_get_level_detail(self):
        EscalationPolicyService.create_escalation_level(
            policy=self.policy,
            actor_membership=self.membership,
            level=1,
            name="Detail Level",
            target_type="ASSIGNEE",
        )
        lvl = self.policy.levels.get(level=1)
        res = self.client.get(f"{self.level_url}{lvl.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Detail Level")


class EscalationRuleAPITest(APITestCase):
    def setUp(self):
        self.user, self.org, self.membership = _setup_org("rule-api")
        self.client.force_authenticate(user=self.user)
        self.policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Rule Test Policy",
        )
        self.rule_url = (
            f"/api/v1/organizations/{self.org.id}"
            f"/escalation-policies/{self.policy.id}/rules/"
        )

    def test_list_rules_empty(self):
        res = self.client.get(self.rule_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_create_rule(self):
        res = self.client.post(
            self.rule_url,
            {"trigger_type": "RESPONSE_BREACH", "is_active": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["trigger_type"], "RESPONSE_BREACH")
        self.assertTrue(res.data["is_active"])

    def test_duplicate_trigger_type_returns_400(self):
        self.client.post(
            self.rule_url,
            {"trigger_type": "RESPONSE_BREACH"},
            format="json",
        )
        res = self.client.post(
            self.rule_url,
            {"trigger_type": "RESPONSE_BREACH"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_trigger_type_returns_400(self):
        res = self.client.post(
            self.rule_url,
            {"trigger_type": "INVALID"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class IncidentEscalationHistoryAPITest(APITestCase):
    """Test the read-only incident escalation history endpoint."""

    def setUp(self):
        self.user, self.org, self.membership = _setup_org("history-api")
        self.client.force_authenticate(user=self.user)

        # Create SLA
        sla_policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=sla_policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )

        # Create escalation policy
        self.esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default Escalation",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.esc_policy,
            actor_membership=self.membership,
            level=1,
            name="L1",
            delay_minutes=0,
            target_type="ASSIGNEE",
        )
        EscalationPolicyService.create_escalation_rule(
            policy=self.esc_policy,
            actor_membership=self.membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )

        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.incident = IncidentService.create_incident(
                self.org, self.user, "History Test", priority=IncidentPriority.P1
            )
        self.history_url = (
            f"/api/v1/organizations/{self.org.id}"
            f"/incidents/{self.incident.id}/escalations/"
        )

    def test_history_empty_before_escalation(self):
        res = self.client.get(self.history_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_history_shows_escalation_after_evaluation(self):
        # Force breach and evaluate
        sla = self.incident.sla
        sla.response_breached = True
        sla.save()

        breach_time = FROZEN_NOW + timedelta(minutes=15)
        from escalation.services import EscalationEvaluationService

        EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=breach_time,
        )

        res = self.client.get(self.history_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        esc = res.data[0]
        self.assertIn("events", esc)
        self.assertEqual(len(esc["events"]), 1)
        self.assertEqual(esc["events"][0]["level"], 1)
        self.assertEqual(esc["events"][0]["trigger_type"], "RESPONSE_BREACH")

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        res = self.client.get(self.history_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_member_returns_404(self):
        outsider = User.objects.create_user(
            email="outsider-hist@api.test", password="Password123!"
        )
        self.client.force_authenticate(user=outsider)
        res = self.client.get(self.history_url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_filter_by_trigger_type(self):
        sla = self.incident.sla
        sla.response_breached = True
        sla.save()

        from escalation.services import EscalationEvaluationService

        EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=15),
        )

        res = self.client.get(self.history_url, {"trigger_type": "RESOLUTION_BREACH"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_filter_by_status(self):
        sla = self.incident.sla
        sla.response_breached = True
        sla.save()

        from escalation.services import EscalationEvaluationService

        EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=15),
        )

        res = self.client.get(self.history_url, {"status": "ACTIVE"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Level 1 of 1 executed → COMPLETED
        self.assertEqual(len(res.data), 0)

        res2 = self.client.get(self.history_url, {"status": "COMPLETED"})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res2.data), 1)


class EscalationEvaluateAPITest(APITestCase):
    """Test the manual evaluate endpoint."""

    def setUp(self):
        self.user, self.org, self.membership = _setup_org("evaluate-api")
        self.client.force_authenticate(user=self.user)

        sla_policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="SLA Policy",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=sla_policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )

        self.esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default Esc",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.esc_policy,
            actor_membership=self.membership,
            level=1,
            name="L1",
            delay_minutes=0,
            target_type="ASSIGNEE",
        )
        EscalationPolicyService.create_escalation_rule(
            policy=self.esc_policy,
            actor_membership=self.membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )

        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Eval API Test", priority=IncidentPriority.P1
            )

        self.eval_url = (
            f"/api/v1/organizations/{self.org.id}"
            f"/incidents/{self.incident.id}/escalations/evaluate/"
        )

    def test_evaluate_no_breach_returns_200_with_skip_message(self):
        res = self.client.post(
            self.eval_url,
            {"trigger_type": "RESPONSE_BREACH"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_evaluate_with_breach_returns_escalation_data(self):
        sla = self.incident.sla
        SLACalculationService.evaluate_sla_status(
            sla, now=FROZEN_NOW + timedelta(minutes=20)
        )
        self.incident.sla.refresh_from_db()

        res = self.client.post(
            self.eval_url,
            {"trigger_type": "RESPONSE_BREACH"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_evaluate_invalid_trigger_returns_400(self):
        res = self.client.post(
            self.eval_url,
            {"trigger_type": "INVALID"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_evaluate_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        res = self.client.post(
            self.eval_url,
            {"trigger_type": "RESPONSE_BREACH"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_evaluate_incident_not_found_returns_404(self):
        import uuid

        fake_url = (
            f"/api/v1/organizations/{self.org.id}"
            f"/incidents/{uuid.uuid4()}/escalations/evaluate/"
        )
        res = self.client.post(
            fake_url, {"trigger_type": "RESPONSE_BREACH"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
