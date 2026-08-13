"""
Phase 7 — Escalation Evaluation Service Tests

Validates:
- Evaluation skips when no SLA breach.
- Evaluation skips when no escalation policy configured.
- Evaluation skips when no active rule.
- Level 1 (delay=0) executes immediately on breach.
- Level 2 (delay=15m) does NOT execute before its delay has elapsed.
- Level 2 executes once delay has elapsed.
- Level 3 (final) execution marks escalation as COMPLETED.
- Idempotency: re-evaluation never duplicates events.
- RESOLVED incidents are skipped.
- CLOSED incidents are skipped.
- EvaluationResult is a deterministic object.
"""

from datetime import timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from escalation.models import EscalationStatus, EscalationTriggerType
from escalation.selectors import get_incident_escalations
from escalation.services import EscalationEvaluationService, EscalationPolicyService
from incidents.models import IncidentPriority, IncidentStatus
from incidents.services import IncidentService
from organizations.services import OrganizationService
from sla.services import SLACalculationService, SLAPolicyService

User = get_user_model()

FROZEN_NOW = timezone.datetime(2026, 1, 15, 10, 0, 0, tzinfo=dt_timezone.utc)


def _setup_org_with_sla_and_escalation(email_prefix: str):
    """
    Create org, owner, default SLA policy with P1 target (response=15m, resolution=60m),
    default escalation policy with 3 levels and RESPONSE_BREACH rule.
    Returns (user, org, membership, incident).
    """
    user = User.objects.create_user(
        email=f"{email_prefix}@eval.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=user, name=f"Eval Org {email_prefix}"
    )
    membership = user.memberships.get(organization=org)

    # SLA: P1 response=15m, resolution=60m
    sla_policy = SLAPolicyService.create_sla_policy(
        organization=org,
        actor_membership=membership,
        name="Default SLA",
        is_active=True,
        is_default=True,
    )
    SLAPolicyService.create_sla_target(
        policy=sla_policy,
        actor_membership=membership,
        priority=IncidentPriority.P1,
        response_time_minutes=15,
        resolution_time_minutes=60,
    )

    # Escalation: default policy, 3 levels, RESPONSE_BREACH rule
    esc_policy = EscalationPolicyService.create_escalation_policy(
        organization=org,
        actor_membership=membership,
        name="Default Escalation",
        is_active=True,
        is_default=True,
    )
    EscalationPolicyService.create_escalation_level(
        policy=esc_policy,
        actor_membership=membership,
        level=1,
        name="Immediate — Assignee",
        delay_minutes=0,
        target_type="ASSIGNEE",
    )
    EscalationPolicyService.create_escalation_level(
        policy=esc_policy,
        actor_membership=membership,
        level=2,
        name="15m — Ops Manager",
        delay_minutes=15,
        target_type="ROLE",
        target_reference=str(org.roles.get(slug="operations-manager").id),
    )
    EscalationPolicyService.create_escalation_level(
        policy=esc_policy,
        actor_membership=membership,
        level=3,
        name="30m — Admin",
        delay_minutes=30,
        target_type="ROLE",
        target_reference=str(org.roles.get(slug="organization-admin").id),
    )
    EscalationPolicyService.create_escalation_rule(
        policy=esc_policy,
        actor_membership=membership,
        trigger_type=EscalationTriggerType.RESPONSE_BREACH,
    )

    return user, org, membership, esc_policy


class EscalationSkipConditionsTest(TestCase):
    """Tests where evaluation should skip and return a skipped reason."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, self.esc_policy = (
                _setup_org_with_sla_and_escalation("skip")
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Skip Test", priority=IncidentPriority.P1
            )

    def test_skip_when_no_sla_breach(self):
        """No breach yet → evaluation is skipped gracefully."""
        # Evaluate immediately after creation (SLA not breached)
        result = EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=5),
        )
        self.assertTrue(result.was_skipped)
        self.assertEqual(result.levels_executed, 0)

    def test_skip_when_no_escalation_policy(self):
        """Org without an escalation policy → graceful skip."""
        user2 = User.objects.create_user(
            email="no-esc@eval.test", password="Password123!"
        )
        org2 = OrganizationService.create_organization(user=user2, name="No Esc Org")
        membership2 = user2.memberships.get(organization=org2)
        sla2 = SLAPolicyService.create_sla_policy(
            organization=org2,
            actor_membership=membership2,
            name="SLA Only",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=sla2,
            actor_membership=membership2,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident2 = IncidentService.create_incident(
                org2, user2, "No Esc", priority=IncidentPriority.P1
            )
        # Force a breach
        sla = incident2.sla
        sla.response_breached = True
        sla.save()

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident2,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=20),
        )
        self.assertTrue(result.was_skipped)
        self.assertIn("No active default escalation policy", result.skipped_reason)

    def test_skip_when_no_active_rule(self):
        """Policy exists but no RESOLUTION_BREACH rule → skip."""
        # Our setup only adds RESPONSE_BREACH rule
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident = IncidentService.create_incident(
                self.org, self.user, "No Rule", priority=IncidentPriority.P1
            )
        sla = incident.sla
        sla.resolution_breached = True
        sla.save()

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident,
            EscalationTriggerType.RESOLUTION_BREACH,
            now=FROZEN_NOW + timedelta(hours=2),
        )
        self.assertTrue(result.was_skipped)
        self.assertIn("No active escalation rule", result.skipped_reason)

    def test_skip_resolved_incident(self):
        """RESOLVED incident must not be escalated."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident = IncidentService.create_incident(
                self.org, self.user, "Resolved Inc", priority=IncidentPriority.P1
            )
        # Walk incident to RESOLVED
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            IncidentService.transition_incident_status(incident, self.membership, s)

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(hours=2),
        )
        self.assertTrue(result.was_skipped)
        self.assertIn("RESOLVED", result.skipped_reason)

    def test_skip_closed_incident(self):
        """CLOSED incident must not be escalated."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident = IncidentService.create_incident(
                self.org, self.user, "Closed Inc", priority=IncidentPriority.P1
            )
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        ]:
            IncidentService.transition_incident_status(incident, self.membership, s)

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(hours=2),
        )
        self.assertTrue(result.was_skipped)
        self.assertIn("CLOSED", result.skipped_reason)


class EscalationLevelTimingTest(TestCase):
    """Test level execution based on delay_minutes and breach time."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, self.esc_policy = (
                _setup_org_with_sla_and_escalation("timing")
            )
            # Create incident; SLA response_deadline = FROZEN_NOW + 15m = 10:15
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Timing Test", priority=IncidentPriority.P1
            )

        # Force SLA breach at the response deadline (10:15)
        sla = self.incident.sla
        sla.response_breached = True
        sla.save()

    def _evaluate(self, minutes_after_frozen):
        return EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=minutes_after_frozen),
        )

    def test_level_1_executes_at_breach_time(self):
        """Level 1 (delay=0) executes as soon as breach occurs."""
        result = self._evaluate(15)  # 10:15 — exactly at breach
        self.assertEqual(result.levels_executed, 1)
        self.assertEqual(result.executed_levels[0].level, 1)

    def test_level_2_not_due_before_15m_delay(self):
        """Level 2 (delay=15m) not due 10 minutes after breach."""
        # Execute level 1 first
        self._evaluate(15)
        # 10 minutes later — level 2 not yet due
        result = self._evaluate(25)  # breach at 10:15, level 2 due at 10:30
        self.assertEqual(result.levels_executed, 0)

    def test_level_2_executes_after_15m_delay(self):
        """Level 2 (delay=15m) executes once delay has elapsed."""
        self._evaluate(15)  # Level 1
        result = self._evaluate(30)  # 10:45 — level 2 (due 10:30)
        self.assertEqual(result.levels_executed, 1)
        self.assertEqual(result.executed_levels[0].level, 2)

    def test_level_3_executes_after_30m_delay(self):
        """Level 3 (delay=30m) executes 30+ minutes after breach."""
        self._evaluate(15)  # Level 1
        self._evaluate(30)  # Level 2
        result = self._evaluate(46)  # breach at 10:15, level 3 due 10:45
        self.assertEqual(result.levels_executed, 1)
        self.assertEqual(result.executed_levels[0].level, 3)

    def test_all_levels_execute_in_one_call_when_all_due(self):
        """
        If evaluation is called only once, long after breach,
        all due levels should be executed in that single call.
        """
        result = self._evaluate(60)  # 60m after FROZEN_NOW — all 3 levels are due
        self.assertEqual(result.levels_executed, 3)
        executed_level_nums = [e.level for e in result.executed_levels]
        self.assertEqual(executed_level_nums, [1, 2, 3])

    def test_escalation_completed_after_final_level(self):
        """After the final level executes, escalation.status becomes COMPLETED."""
        self._evaluate(60)  # All 3 levels due
        escalations = get_incident_escalations(self.incident)
        self.assertEqual(escalations.count(), 1)
        esc = escalations.first()
        self.assertEqual(esc.status, EscalationStatus.COMPLETED)
        self.assertIsNotNone(esc.completed_at)

    def test_escalation_active_until_final_level(self):
        """After level 1 only, escalation is still ACTIVE."""
        self._evaluate(15)
        escalations = get_incident_escalations(self.incident)
        esc = escalations.first()
        self.assertEqual(esc.status, EscalationStatus.ACTIVE)

    def test_current_level_tracks_latest_executed(self):
        self._evaluate(15)  # Level 1
        esc = get_incident_escalations(self.incident).first()
        self.assertEqual(esc.current_level, 1)

        self._evaluate(30)  # Level 2
        esc.refresh_from_db()
        self.assertEqual(esc.current_level, 2)

    def test_last_evaluated_at_is_updated_each_call(self):
        t1 = FROZEN_NOW + timedelta(minutes=15)
        t2 = FROZEN_NOW + timedelta(minutes=30)
        self._evaluate(15)
        esc = get_incident_escalations(self.incident).first()
        self.assertEqual(esc.last_evaluated_at, t1)

        self._evaluate(30)
        esc.refresh_from_db()
        self.assertEqual(esc.last_evaluated_at, t2)


class EscalationIdempotencyTest(TestCase):
    """Repeated evaluations must never produce duplicate escalation events."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, self.esc_policy = (
                _setup_org_with_sla_and_escalation("idempotent")
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Idempotent Test", priority=IncidentPriority.P1
            )
        sla = self.incident.sla
        sla.response_breached = True
        sla.save()

    def _evaluate(self, minutes):
        return EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=minutes),
        )

    def test_level_1_only_once_with_repeated_evaluation(self):
        """
        Calling evaluate 3 times at the same time must produce exactly
        ONE level-1 event, not 3.
        """
        self._evaluate(15)
        self._evaluate(15)
        self._evaluate(15)

        esc = get_incident_escalations(self.incident).first()
        self.assertIsNotNone(esc)
        events = esc.events.filter(level=1)
        self.assertEqual(events.count(), 1)

    def test_level_2_only_once_after_delay_and_re_evaluation(self):
        """Level 2 is triggered once even after 5 re-evaluations."""
        self._evaluate(15)  # Level 1
        for _ in range(5):
            self._evaluate(31)  # Level 2 due from 10:30

        esc = get_incident_escalations(self.incident).first()
        events = esc.events.filter(level=2)
        self.assertEqual(events.count(), 1)

    def test_all_levels_execute_exactly_once_over_multiple_calls(self):
        """
        Simulate staggered evaluation: call at 10:15, 10:16, 10:17 (level1 only),
        then 10:31, 10:32 (level2), then 10:46, 10:47 (level3).
        Total events must be exactly 3 (one per level).
        """
        for m in [15, 16, 17]:
            self._evaluate(m)
        for m in [31, 32]:
            self._evaluate(m)
        for m in [46, 47]:
            self._evaluate(m)

        esc = get_incident_escalations(self.incident).first()
        self.assertEqual(esc.events.count(), 3)
        for level_num in [1, 2, 3]:
            self.assertEqual(esc.events.filter(level=level_num).count(), 1)

    def test_completed_escalation_accepts_no_new_events(self):
        """After status=COMPLETED, additional evaluations produce zero new events."""
        self._evaluate(60)  # Execute all 3 levels

        esc = get_incident_escalations(self.incident).first()
        self.assertEqual(esc.status, EscalationStatus.COMPLETED)
        prior_count = esc.events.count()

        # Try evaluating again — escalation is COMPLETED, nothing should run
        result = self._evaluate(90)
        self.assertEqual(result.levels_executed, 0)
        esc.refresh_from_db()
        self.assertEqual(esc.events.count(), prior_count)

    def test_unknown_trigger_type_is_gracefully_skipped(self):
        result = EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            "UNKNOWN_TRIGGER",
        )
        self.assertTrue(result.was_skipped)
        self.assertIn("Unknown trigger_type", result.skipped_reason)


class EscalationSLAIntegrationTest(TestCase):
    """
    Test that the escalation engine reads SLA breach state from the existing
    SLA engine rather than re-computing it.
    """

    def test_no_escalation_without_sla_breach(self):
        """
        An incident whose SLA has not breached must not produce any
        escalation event, regardless of time elapsed.
        """
        user, org, _, _ = _setup_org_with_sla_and_escalation("sla-int")
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident = IncidentService.create_incident(
                org, user, "SLA Integration", priority=IncidentPriority.P1
            )

        # SLA response deadline is at FROZEN_NOW + 15m = 10:15
        # Evaluate at 10:10 — NOT breached yet
        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=10),
        )
        self.assertTrue(result.was_skipped)
        self.assertEqual(result.levels_executed, 0)

    def test_escalation_uses_sla_breach_flag_not_recalculates(self):
        """
        Even if current_time > response_deadline, if response_breached=False
        on the IncidentSLA, escalation must NOT fire. The SLA engine is
        authoritative; the escalation engine reads its output.
        """
        user, org, _, _ = _setup_org_with_sla_and_escalation("sla-auth")
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident = IncidentService.create_incident(
                org, user, "SLA Auth", priority=IncidentPriority.P1
            )

        sla = incident.sla
        # Deadline is past but breached flag is still False (SLA engine hasn't run)
        self.assertFalse(sla.response_breached)

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=FROZEN_NOW + timedelta(minutes=30),  # past deadline
        )
        # Should skip — breach flag is False, engine doesn't re-evaluate SLA
        self.assertTrue(result.was_skipped)

    def test_escalation_fires_when_sla_breach_flag_set(self):
        """
        Once response_breached=True (set by SLACalculationService.evaluate_sla_status),
        the escalation engine should execute level 1 immediately.
        """
        user, org, _, _ = _setup_org_with_sla_and_escalation("sla-fire")
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            incident = IncidentService.create_incident(
                org, user, "SLA Fire", priority=IncidentPriority.P1
            )

        breach_time = FROZEN_NOW + timedelta(minutes=15)
        # Use the real SLA evaluation service to mark the breach
        SLACalculationService.evaluate_sla_status(
            incident.sla, now=breach_time + timedelta(minutes=1)
        )
        incident.sla.refresh_from_db()
        self.assertTrue(incident.sla.response_breached)

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=breach_time + timedelta(minutes=1),
        )
        self.assertFalse(result.was_skipped)
        self.assertEqual(result.levels_executed, 1)
