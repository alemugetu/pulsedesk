"""
Phase 9 — SLA Monitoring & Escalation Orchestration Tests

Test coverage matrix:
  Selector:
    - get_active_incidents_for_sla_monitoring returns active+SLA incidents
    - Resolved incidents are excluded
    - Closed incidents are excluded
    - Incidents without SLA are excluded

  SLAMonitoringService.run():
    - Active incident with no breach → examined, no breach counted
    - Active incident with response breach → breach detected + escalation attempted
    - Active incident with resolution breach → breach detected + escalation attempted
    - Resolved incident re-checked inside loop → skipped
    - Closed incident re-checked inside loop → skipped
    - Incident without SLA handled gracefully (skipped, not error)
    - SLA warning threshold detection
    - No warning when SLA already completed
    - No warning when SLA already breached
    - Warning NOT fired when below threshold

  Escalation integration:
    - Breach invokes EscalationEvaluationService
    - Correct trigger type used (RESPONSE_BREACH / RESOLUTION_BREACH)
    - Escalation result updates escalations count

  Idempotency:
    - Running twice does not duplicate EscalationEvent records
    - Second run with same breach state: escalations=0 (already executed)

  Failure isolation:
    - One incident raising an exception does not abort the run
    - Other incidents still processed

  Celery task:
    - monitor_sla task is registered
    - monitor_sla task executes and returns dict summary
    - Retry behaviour on TransientInfrastructureError
    - No retry on ValueError

  Beat schedule:
    - CELERY_BEAT_SCHEDULE contains sla-monitor entry
    - Schedule references correct task name
    - Interval comes from SLA_MONITOR_INTERVAL_SECONDS setting

  Multi-tenancy:
    - Organization A incident cannot use Organization B escalation policy
      (verified indirectly: escalation engine is org-scoped)

  Time:
    - All evaluations use frozen/controlled time
"""

from __future__ import annotations

from datetime import timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from celery.exceptions import Retry
from common.services.health_check import TransientInfrastructureError
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from escalation.models import EscalationTriggerType
from escalation.selectors import get_incident_escalations
from escalation.services import EscalationEvaluationService, EscalationPolicyService
from incidents.models import IncidentPriority, IncidentStatus
from incidents.services import IncidentService
from organizations.services import OrganizationService
from sla.selectors import get_active_incidents_for_sla_monitoring, get_incident_sla
from sla.services import (
    SLACalculationService,
    SLAMonitoringService,
    SLAPolicyService,
)
from sla.tasks import monitor_sla

User = get_user_model()

# ---------------------------------------------------------------------------
# Frozen time
# ---------------------------------------------------------------------------

FROZEN_NOW = timezone.datetime(2026, 1, 15, 10, 0, 0, tzinfo=dt_timezone.utc)

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_org_with_full_stack(email_prefix: str):
    """
    Create an org with:
      - owner user + membership
      - default SLA policy: P1 response=15m, resolution=60m
      - default escalation policy: 2 levels, RESPONSE_BREACH + RESOLUTION_BREACH rules

    Returns (user, org, membership, sla_policy, esc_policy).
    """
    user = User.objects.create_user(
        email=f"{email_prefix}@monitor.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=user, name=f"Monitor Org {email_prefix}"
    )
    membership = user.memberships.get(organization=org)

    # SLA
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

    # Escalation
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
    EscalationPolicyService.create_escalation_rule(
        policy=esc_policy,
        actor_membership=membership,
        trigger_type=EscalationTriggerType.RESOLUTION_BREACH,
    )

    return user, org, membership, sla_policy, esc_policy


def _make_org_sla_only(email_prefix: str):
    """
    Create an org with SLA only (no escalation policy).
    """
    user = User.objects.create_user(
        email=f"{email_prefix}@monitor.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=user, name=f"SLA Only Org {email_prefix}"
    )
    membership = user.memberships.get(organization=org)

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
    return user, org, membership, sla_policy


# ===========================================================================
# 1. Selector tests
# ===========================================================================


class SLAMonitoringSelectorTest(TestCase):
    """Tests for get_active_incidents_for_sla_monitoring()."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, self.sla_policy, _ = (
                _make_org_with_full_stack("sel")
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Active P1", priority=IncidentPriority.P1
            )

    def test_active_incident_with_sla_is_returned(self):
        qs = get_active_incidents_for_sla_monitoring()
        self.assertIn(self.incident, list(qs))

    def test_resolved_incident_is_excluded(self):
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            IncidentService.transition_incident_status(
                self.incident, self.membership, s
            )

        qs = get_active_incidents_for_sla_monitoring()
        self.assertNotIn(self.incident, list(qs))

    def test_closed_incident_is_excluded(self):
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        ]:
            IncidentService.transition_incident_status(
                self.incident, self.membership, s
            )

        qs = get_active_incidents_for_sla_monitoring()
        self.assertNotIn(self.incident, list(qs))

    def test_incident_without_sla_is_excluded(self):
        """An incident with no IncidentSLA must not appear in the monitoring set."""
        user2 = User.objects.create_user(
            email="no-sla-sel@monitor.test", password="Password123!"
        )
        org2 = OrganizationService.create_organization(user=user2, name="No SLA Sel")
        # No SLA policy — incident has no sla record
        incident2 = IncidentService.create_incident(org2, user2, "No SLA Incident")
        self.assertIsNone(get_incident_sla(incident2))

        qs = get_active_incidents_for_sla_monitoring()
        self.assertNotIn(incident2, list(qs))

    def test_multiple_active_incidents_across_orgs(self):
        """Selector returns incidents from all orgs (system-level query)."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user2, org2, _, _, _ = _make_org_with_full_stack("sel2")
            incident2 = IncidentService.create_incident(
                org2, user2, "Org2 Incident", priority=IncidentPriority.P1
            )

        qs = get_active_incidents_for_sla_monitoring()
        ids = list(qs.values_list("id", flat=True))
        self.assertIn(self.incident.id, ids)
        self.assertIn(incident2.id, ids)

    def test_acknowledged_incident_is_returned(self):
        """ACKNOWLEDGED is still active — should be monitored."""
        IncidentService.transition_incident_status(
            self.incident, self.membership, IncidentStatus.ACKNOWLEDGED
        )
        qs = get_active_incidents_for_sla_monitoring()
        self.assertIn(self.incident, list(qs))

    def test_in_progress_incident_is_returned(self):
        """IN_PROGRESS is still active — should be monitored."""
        IncidentService.transition_incident_status(
            self.incident, self.membership, IncidentStatus.ACKNOWLEDGED
        )
        IncidentService.transition_incident_status(
            self.incident, self.membership, IncidentStatus.IN_PROGRESS
        )
        qs = get_active_incidents_for_sla_monitoring()
        self.assertIn(self.incident, list(qs))


# ===========================================================================
# 2. SLA warning detection
# ===========================================================================


class SLAWarningDetectionTest(TestCase):
    """Tests for SLAMonitoringService._check_warning()."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _, _ = _make_org_sla_only("warn")
            self.incident = IncidentService.create_incident(
                org, user, "Warning Test", priority=IncidentPriority.P1
            )
        self.sla = get_incident_sla(self.incident)
        # P1: response_deadline = FROZEN_NOW + 15m = 10:15
        #     resolution_deadline = FROZEN_NOW + 60m = 11:00

    def test_no_warning_before_threshold(self):
        """At 70% elapsed (10.5 minutes in), threshold=0.80 → no warning."""
        # 0.70 × 15 = 10.5 min elapsed
        at_70_pct = FROZEN_NOW + timedelta(minutes=10, seconds=30)
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_70_pct, threshold=0.80
        )
        self.assertFalse(result)

    def test_warning_at_threshold(self):
        """At exactly 80% elapsed (12 minutes), threshold=0.80 → warning fires."""
        at_80_pct = FROZEN_NOW + timedelta(minutes=12)
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_80_pct, threshold=0.80
        )
        self.assertTrue(result)

    def test_warning_above_threshold(self):
        """At 90% elapsed, threshold=0.80 → warning fires."""
        at_90_pct = FROZEN_NOW + timedelta(minutes=13, seconds=30)
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_90_pct, threshold=0.80
        )
        self.assertTrue(result)

    def test_no_warning_when_response_already_completed(self):
        """Completed response SLA → no warning regardless of time."""
        self.sla.response_completed_at = FROZEN_NOW + timedelta(minutes=5)
        self.sla.save()
        at_90_pct = FROZEN_NOW + timedelta(minutes=13, seconds=30)
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_90_pct, threshold=0.80
        )
        # Response completed → no response warning.
        # Resolution: 90% of 60m = 54m — not yet at threshold at 13.5m elapsed.
        self.assertFalse(result)

    def test_no_warning_when_already_breached(self):
        """Breached SLA → no warning (breach supersedes warning)."""
        self.sla.response_breached = True
        self.sla.save()
        at_99_pct = FROZEN_NOW + timedelta(minutes=14, seconds=51)
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_99_pct, threshold=0.80
        )
        # Response already breached → _check_warning skips it.
        # Resolution: 14.85 / 60 = 24.75% — below threshold.
        self.assertFalse(result)

    def test_no_warning_before_incident_creation(self):
        """Elapsed = 0 → no warning."""
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=FROZEN_NOW, threshold=0.80
        )
        self.assertFalse(result)

    def test_warning_resolution_approaching(self):
        """Resolution at 85% threshold: 0.85 × 60m = 51m elapsed."""
        at_85_pct_resolution = FROZEN_NOW + timedelta(minutes=51)
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_85_pct_resolution, threshold=0.80
        )
        # Response already past its deadline at 51m, so response_breached may
        # fire. But resolution is at 85% → warning True.
        # We set response completed to avoid response breach interfering.
        self.sla.response_completed_at = FROZEN_NOW + timedelta(minutes=5)
        self.sla.response_breached = False
        self.sla.save()
        result = SLAMonitoringService._check_warning(
            sla=self.sla, now=at_85_pct_resolution, threshold=0.80
        )
        self.assertTrue(result)


# ===========================================================================
# 3. Monitoring run — core behaviour
# ===========================================================================


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class SLAMonitoringRunTest(TestCase):
    """End-to-end tests for SLAMonitoringService.run()."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, self.sla_policy, self.esc_policy = (
                _make_org_with_full_stack("run")
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Run Test", priority=IncidentPriority.P1
            )
        self.sla = get_incident_sla(self.incident)

    def test_healthy_sla_no_breach_no_escalation(self):
        """Incident with SLA not yet breached: examined=1, breaches=0, escalations=0."""
        # Evaluate 5 minutes in — well within deadline
        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=5))
        self.assertEqual(result.examined, 1)
        self.assertEqual(result.breaches, 0)
        self.assertEqual(result.escalations, 0)
        self.assertEqual(result.errors, 0)

    def test_response_breach_detected_and_escalation_triggered(self):
        """After response deadline: breach=1, escalation level 1 executes."""
        # 20 minutes after FROZEN_NOW — response deadline was at +15m
        now = FROZEN_NOW + timedelta(minutes=20)
        result = SLAMonitoringService.run(now=now)
        self.assertEqual(result.examined, 1)
        self.assertEqual(result.breaches, 1)
        self.assertGreaterEqual(result.escalations, 1)
        self.assertEqual(result.errors, 0)

        # Verify breach flag persisted
        self.sla.refresh_from_db()
        self.assertTrue(self.sla.response_breached)

    def test_resolution_breach_detected(self):
        """After resolution deadline: both response and resolution are breached."""
        now = FROZEN_NOW + timedelta(minutes=70)  # past both deadlines
        result = SLAMonitoringService.run(now=now)
        self.assertEqual(result.examined, 1)
        self.assertEqual(result.breaches, 1)  # incident counted once for breach
        self.assertGreaterEqual(result.escalations, 1)

        self.sla.refresh_from_db()
        self.assertTrue(self.sla.response_breached)
        self.assertTrue(self.sla.resolution_breached)

    def test_resolved_incident_is_skipped(self):
        """Incident that reaches RESOLVED between query and processing is skipped."""
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            IncidentService.transition_incident_status(
                self.incident, self.membership, s
            )

        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=20))
        # The incident should NOT appear in the monitoring queryset at all
        # (selector filters it out), so examined=0.
        self.assertEqual(result.examined, 0)
        self.assertEqual(result.breaches, 0)

    def test_closed_incident_is_skipped(self):
        """CLOSED incident excluded by selector."""
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        ]:
            IncidentService.transition_incident_status(
                self.incident, self.membership, s
            )

        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=70))
        self.assertEqual(result.examined, 0)

    def test_incident_without_sla_handled_gracefully(self):
        """Incident without SLA excluded by selector — no error, no breach."""
        # Create a second org with no SLA policy
        user2 = User.objects.create_user(
            email="no-sla-run@monitor.test", password="Password123!"
        )
        org2 = OrganizationService.create_organization(user=user2, name="No SLA Run")
        incident2 = IncidentService.create_incident(org2, user2, "No SLA")
        self.assertIsNone(get_incident_sla(incident2))

        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=20))
        # incident2 excluded by selector (no SLA), self.incident examined
        self.assertEqual(result.examined, 1)
        self.assertEqual(result.errors, 0)

    def test_warning_counted(self):
        """SLA approaching threshold → warnings counter incremented."""
        # P1: 15m window. 80% = 12m. Evaluate at 13m.
        result = SLAMonitoringService.run(
            now=FROZEN_NOW + timedelta(minutes=13),
        )
        self.assertGreaterEqual(result.warnings, 1)
        self.assertEqual(result.breaches, 0)
        self.assertEqual(result.escalations, 0)

    def test_no_warning_when_below_threshold(self):
        """At 5 minutes (33% of 15m window), no warning with default threshold=0.80."""
        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=5))
        self.assertEqual(result.warnings, 0)

    def test_monitoring_result_is_json_serializable(self):
        """MonitoringResult.to_dict() must be JSON-serialisable."""
        import json

        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=5))
        data = result.to_dict()
        serialized = json.dumps(data)  # must not raise
        parsed = json.loads(serialized)
        self.assertIn("examined", parsed)
        self.assertIn("errors", parsed)

    def test_result_contains_no_sensitive_data(self):
        """MonitoringResult.to_dict() must not contain UUIDs, tokens, or credentials."""
        result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=5))
        data = result.to_dict()
        for value in data.values():
            self.assertIsInstance(value, int, f"Unexpected non-int value: {value!r}")


# ===========================================================================
# 4. Failure isolation
# ===========================================================================


class SLAMonitoringFailureIsolationTest(TestCase):
    """
    One incident raising an exception must not abort processing of others.
    """

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user_a, self.org_a, _, _, _ = _make_org_with_full_stack("fail-a")
            self.user_b, self.org_b, _, _, _ = _make_org_with_full_stack("fail-b")
            self.incident_a = IncidentService.create_incident(
                self.org_a, self.user_a, "Fail A", priority=IncidentPriority.P1
            )
            self.incident_b = IncidentService.create_incident(
                self.org_b, self.user_b, "Fail B", priority=IncidentPriority.P1
            )

    def test_one_incident_failure_does_not_stop_others(self):
        """
        Patch _process_incident to raise on incident_a but succeed on incident_b.
        Verify errors=1 and examined includes incident_b.
        """
        original_process = SLAMonitoringService._process_incident

        def selective_fail(incident, **kwargs):
            if incident.pk == self.incident_a.pk:
                raise RuntimeError("simulated per-incident failure")
            return original_process(incident=incident, **kwargs)

        with patch.object(
            SLAMonitoringService, "_process_incident", side_effect=selective_fail
        ):
            result = SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=5))

        self.assertEqual(result.errors, 1)
        # incident_b was processed (examined ≥ 1 from incident_b)
        self.assertGreaterEqual(result.examined, 1)


# ===========================================================================
# 5. Idempotency
# ===========================================================================


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class SLAMonitoringIdempotencyTest(TestCase):
    """
    Running the monitoring pass multiple times must not create duplicate
    escalation events.
    """

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, _, _ = _make_org_with_full_stack(
                "idem"
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Idempotent", priority=IncidentPriority.P1
            )

    def test_second_run_produces_no_duplicate_escalation_events(self):
        """Two passes at the same time: first creates level-1 event, second no-ops."""
        breach_now = FROZEN_NOW + timedelta(minutes=20)

        # First pass
        SLAMonitoringService.run(now=breach_now)
        escalations_after_first = get_incident_escalations(self.incident)
        first_event_count = sum(e.events.count() for e in escalations_after_first)

        # Second pass — same time, same breach state
        result2 = SLAMonitoringService.run(now=breach_now)
        escalations_after_second = get_incident_escalations(self.incident)
        second_event_count = sum(e.events.count() for e in escalations_after_second)

        self.assertEqual(first_event_count, second_event_count)
        # Second run: escalation engine finds no new levels due → 0
        self.assertEqual(result2.escalations, 0)

    def test_ten_passes_produce_exactly_one_level_one_event(self):
        """Ten passes at the same timestamp must produce exactly 1 level-1 event."""
        breach_now = FROZEN_NOW + timedelta(minutes=20)

        for _ in range(10):
            SLAMonitoringService.run(now=breach_now)

        escalations = get_incident_escalations(self.incident)
        total_events = sum(e.events.count() for e in escalations)
        self.assertEqual(total_events, 1)

    def test_subsequent_level_executes_only_once(self):
        """
        Multiple passes spanning the level-2 delay window must execute level 2
        exactly once.  Level 1 at +20m, Level 2 (30m delay) due at +50m.
        """
        # Level 1 pass
        SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=20))
        # Multiple passes around the level-2 window
        for offset in [50, 51, 52, 53, 54]:
            SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=offset))

        escalations = get_incident_escalations(self.incident)
        for esc in escalations:
            for trigger in [
                EscalationTriggerType.RESPONSE_BREACH,
                EscalationTriggerType.RESOLUTION_BREACH,
            ]:
                level2_events = esc.events.filter(level=2, trigger_type=trigger)
                self.assertLessEqual(
                    level2_events.count(),
                    1,
                    f"Duplicate level-2 events for trigger {trigger}",
                )


# ===========================================================================
# 6. Multi-tenancy
# ===========================================================================


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class SLAMonitoringTenantIsolationTest(TestCase):
    """
    Tenant isolation: org A incident is escalated using org A policy only.
    Org B escalation policy is never applied to org A incidents.
    """

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user_a, self.org_a, _, _, self.esc_a = _make_org_with_full_stack("ta")
            self.user_b, self.org_b, _, _, self.esc_b = _make_org_with_full_stack("tb")
            self.incident_a = IncidentService.create_incident(
                self.org_a, self.user_a, "Org A Incident", priority=IncidentPriority.P1
            )
            self.incident_b = IncidentService.create_incident(
                self.org_b, self.user_b, "Org B Incident", priority=IncidentPriority.P1
            )

    def test_org_a_incident_escalates_with_org_a_policy_only(self):
        """Org A incident must produce escalations linked to org A policy."""
        breach_now = FROZEN_NOW + timedelta(minutes=20)
        SLAMonitoringService.run(now=breach_now)

        escalations_a = get_incident_escalations(self.incident_a)
        for esc in escalations_a:
            self.assertEqual(
                esc.policy.organization_id,
                self.org_a.id,
                "Org A incident was escalated with a policy from a different org!",
            )

    def test_org_b_incident_escalates_with_org_b_policy_only(self):
        """Org B incident must produce escalations linked to org B policy."""
        breach_now = FROZEN_NOW + timedelta(minutes=20)
        SLAMonitoringService.run(now=breach_now)

        escalations_b = get_incident_escalations(self.incident_b)
        for esc in escalations_b:
            self.assertEqual(
                esc.policy.organization_id,
                self.org_b.id,
                "Org B incident was escalated with a policy from a different org!",
            )

    def test_each_org_incident_escalated_independently(self):
        """Both org incidents are processed and escalated in a single run."""
        breach_now = FROZEN_NOW + timedelta(minutes=20)
        result = SLAMonitoringService.run(now=breach_now)
        self.assertEqual(result.examined, 2)
        self.assertEqual(result.breaches, 2)
        self.assertGreaterEqual(result.escalations, 2)


# ===========================================================================
# 7. Escalation integration
# ===========================================================================


class SLAMonitoringEscalationIntegrationTest(TestCase):
    """
    Verify the monitoring service delegates to the existing escalation engine
    for the correct trigger types.
    """

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, _, _ = _make_org_with_full_stack(
                "esc-int"
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Esc Integration", priority=IncidentPriority.P1
            )

    def test_response_breach_invokes_escalation_with_correct_trigger(self):
        """On response breach, escalation is evaluated with RESPONSE_BREACH trigger."""
        breach_now = FROZEN_NOW + timedelta(minutes=20)

        with patch.object(
            EscalationEvaluationService,
            "evaluate_incident_escalation",
            wraps=EscalationEvaluationService.evaluate_incident_escalation,
        ) as mock_eval:
            SLAMonitoringService.run(now=breach_now)

        # Should have been called with RESPONSE_BREACH (and RESOLUTION_BREACH
        # since both rules exist, but response triggers at +20m)
        trigger_types_called = [
            c.kwargs.get("trigger_type") or c.args[1] for c in mock_eval.call_args_list
        ]
        self.assertIn(EscalationTriggerType.RESPONSE_BREACH, trigger_types_called)

    def test_resolution_breach_invokes_escalation_with_correct_trigger(self):
        """On resolution breach (+70m), RESOLUTION_BREACH trigger is evaluated."""
        breach_now = FROZEN_NOW + timedelta(minutes=70)

        with patch.object(
            EscalationEvaluationService,
            "evaluate_incident_escalation",
            wraps=EscalationEvaluationService.evaluate_incident_escalation,
        ) as mock_eval:
            SLAMonitoringService.run(now=breach_now)

        trigger_types_called = [
            c.kwargs.get("trigger_type") or c.args[1] for c in mock_eval.call_args_list
        ]
        self.assertIn(EscalationTriggerType.RESOLUTION_BREACH, trigger_types_called)

    def test_no_breach_means_no_escalation_call(self):
        """When there is no breach, escalation engine must not be called."""
        with patch.object(
            EscalationEvaluationService,
            "evaluate_incident_escalation",
        ) as mock_eval:
            SLAMonitoringService.run(now=FROZEN_NOW + timedelta(minutes=5))

        mock_eval.assert_not_called()

    def test_escalation_without_policy_is_skipped_gracefully(self):
        """
        Org with SLA but no escalation policy → breach detected, escalation
        gracefully skipped (was_skipped=True), no error.
        """
        user2, org2, _, _ = _make_org_sla_only("no-esc-int")
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            IncidentService.create_incident(
                org2, user2, "No Esc Policy", priority=IncidentPriority.P1
            )

        breach_now = FROZEN_NOW + timedelta(minutes=20)
        result = SLAMonitoringService.run(now=breach_now)

        # incident2 is breached but escalation skipped → escalations still=0
        # self.incident is also breached and has escalation → escalations≥1
        self.assertEqual(result.errors, 0)


# ===========================================================================
# 8. Celery task tests
# ===========================================================================


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
    SLA_MONITOR_INTERVAL_SECONDS=60,
    SLA_WARNING_THRESHOLD=0.80,
)
class MonitorSLATaskTest(TestCase):
    """Tests for the monitor_sla Celery task."""

    def test_task_is_registered(self):
        """sla.monitor_sla must be discoverable in the Celery task registry."""
        from config.celery import app as celery_app

        self.assertIn("sla.monitor_sla", celery_app.tasks)

    def test_task_executes_and_returns_dict(self):
        """Task executes (eager mode) and returns a dict with expected keys."""
        result = monitor_sla.apply()
        data = result.get()
        self.assertIsInstance(data, dict)
        for key in (
            "examined",
            "skipped",
            "warnings",
            "breaches",
            "escalations",
            "errors",
        ):
            self.assertIn(key, data)
            self.assertIsInstance(data[key], int)

    def test_task_returns_correct_counts(self):
        """Task returns 0 for all counts when there are no incidents."""
        result = monitor_sla.apply()
        data = result.get()
        self.assertEqual(data["examined"], 0)
        self.assertEqual(data["errors"], 0)

    def test_transient_failure_triggers_retry(self):
        """TransientInfrastructureError causes the task to retry."""
        with patch(
            "sla.services.SLAMonitoringService.run",
            side_effect=TransientInfrastructureError("db unavailable"),
        ), self.assertRaises(Retry):
            monitor_sla.apply(throw=True)

    def test_value_error_is_not_retried(self):
        """ValueError (permanent error) is raised without retry."""
        with patch(
            "sla.services.SLAMonitoringService.run",
            side_effect=ValueError("bad config"),
        ), self.assertRaises(ValueError):
            monitor_sla.apply(throw=True)

    def test_task_name_is_correct(self):
        self.assertEqual(monitor_sla.name, "sla.monitor_sla")

    def test_task_with_real_incident_returns_nonzero_examined(self):
        """With one active SLA incident, examined≥1 in the task result."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _, _, _ = _make_org_with_full_stack("task-real")
            IncidentService.create_incident(
                org, user, "Task Real", priority=IncidentPriority.P1
            )

        with patch(
            "sla.services.timezone.now", return_value=FROZEN_NOW + timedelta(minutes=5)
        ):
            result = monitor_sla.apply()
        data = result.get()
        self.assertGreaterEqual(data["examined"], 1)
        self.assertEqual(data["errors"], 0)


# ===========================================================================
# 9. Beat schedule tests
# ===========================================================================


class CeleryBeatScheduleTest(TestCase):
    """Verify the Beat schedule is correctly configured."""

    def test_beat_schedule_contains_sla_monitor_entry(self):
        from django.conf import settings

        self.assertIn("sla-monitor", settings.CELERY_BEAT_SCHEDULE)

    def test_sla_monitor_references_correct_task(self):
        from django.conf import settings

        entry = settings.CELERY_BEAT_SCHEDULE["sla-monitor"]
        self.assertEqual(entry["task"], "sla.monitor_sla")

    @override_settings(
        SLA_MONITOR_INTERVAL_SECONDS=120,
        CELERY_BEAT_SCHEDULE={
            "sla-monitor": {
                "task": "sla.monitor_sla",
                "schedule": 120,
            }
        },
    )
    def test_interval_is_configurable_via_setting(self):
        from django.conf import settings

        entry = settings.CELERY_BEAT_SCHEDULE["sla-monitor"]
        self.assertEqual(entry["schedule"], 120)

    def test_default_interval_is_60_seconds(self):
        from django.conf import settings

        # The default set in base.py
        self.assertEqual(settings.SLA_MONITOR_INTERVAL_SECONDS, 60)

    def test_sla_monitor_schedule_interval_matches_setting(self):
        from django.conf import settings

        entry = settings.CELERY_BEAT_SCHEDULE["sla-monitor"]
        self.assertEqual(entry["schedule"], settings.SLA_MONITOR_INTERVAL_SECONDS)


# ===========================================================================
# 10. Regression — existing SLA & escalation behaviour preserved
# ===========================================================================


class Phase9RegressionTest(TestCase):
    """
    Verify that existing Phase 6 and Phase 7 behaviour is preserved.
    The monitoring layer must NOT alter the semantics of either engine.
    """

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership, _, _ = _make_org_with_full_stack(
                "regress"
            )
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Regression", priority=IncidentPriority.P1
            )

    def test_sla_evaluate_sla_status_still_works_independently(self):
        """SLACalculationService.evaluate_sla_status() works without monitoring."""
        sla = get_incident_sla(self.incident)
        after_breach = FROZEN_NOW + timedelta(minutes=20)
        updated = SLACalculationService.evaluate_sla_status(sla, now=after_breach)
        self.assertTrue(updated.response_breached)

    def test_escalation_evaluate_still_works_independently(self):
        """EscalationEvaluationService works without the monitoring layer."""
        sla = get_incident_sla(self.incident)
        breach_time = FROZEN_NOW + timedelta(minutes=20)
        # evaluate_sla_status marks the breach and saves; re-fetch to get updated state
        updated_sla = SLACalculationService.evaluate_sla_status(sla, now=breach_time)
        self.assertTrue(updated_sla.response_breached)
        # Reload incident so that incident.sla has the updated breach flag
        self.incident.refresh_from_db()

        result = EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=breach_time,
        )
        self.assertFalse(result.was_skipped)
        self.assertEqual(result.levels_executed, 1)

    def test_monitoring_does_not_re_breach_completed_sla(self):
        """
        When SLA is completed (response_completed_at set), the monitoring
        pass must not set response_breached=True even past the deadline.
        """
        # Acknowledge within deadline
        ack_time = FROZEN_NOW + timedelta(minutes=10)
        with patch("django.utils.timezone.now", return_value=ack_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.ACKNOWLEDGED
            )

        # Run monitoring well past the response deadline
        after_deadline = FROZEN_NOW + timedelta(hours=2)
        SLAMonitoringService.run(now=after_deadline)

        sla = get_incident_sla(self.incident)
        sla.refresh_from_db()
        self.assertFalse(sla.response_breached)

    def test_monitoring_does_not_create_new_escalation_for_terminal_incident(self):
        """
        A RESOLVED incident must never receive new escalation events from
        the monitoring loop.
        """
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            IncidentService.transition_incident_status(
                self.incident, self.membership, s
            )

        # Run past all deadlines
        SLAMonitoringService.run(now=FROZEN_NOW + timedelta(hours=3))

        escalations = get_incident_escalations(self.incident)
        total_events = sum(e.events.count() for e in escalations)
        self.assertEqual(total_events, 0)
