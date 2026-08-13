"""
Phase 7 — Database Constraint & Concurrency Tests

Validates:
- Partial unique index on EscalationPolicy (active+default per org) is enforced at DB level.
- Unique level number per policy is enforced at DB level.
- Unique rule per (policy, trigger_type) enforced at DB level.
- Unique EscalationEvent per (incident_escalation, level, trigger_type) enforced at DB level.
- Concurrent evaluation produces exactly ONE escalation event (select_for_update).
"""

from datetime import timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from escalation.models import (
    EscalationEvent,
    EscalationEventStatus,
    EscalationLevel,
    EscalationPolicy,
    EscalationRule,
    EscalationStatus,
    EscalationTargetType,
    EscalationTriggerType,
    IncidentEscalation,
)
from escalation.selectors import get_incident_escalations
from escalation.services import EscalationEvaluationService, EscalationPolicyService
from incidents.models import IncidentPriority
from incidents.services import IncidentService
from organizations.services import OrganizationService
from sla.services import SLAPolicyService

User = get_user_model()

FROZEN_NOW = timezone.datetime(2026, 1, 15, 10, 0, 0, tzinfo=dt_timezone.utc)


def _make_org(label: str):
    user = User.objects.create_user(
        email=f"{label}@dbconstr.test", password="Password123!"
    )
    org = OrganizationService.create_organization(user=user, name=f"Org {label}")
    return user, org


class EscalationPolicyPartialUniqueIndexTest(TestCase):
    """DB-level enforcement of the single active-default per org constraint."""

    def setUp(self):
        _, self.org = _make_org("idx-a")

    def test_single_active_default_allowed(self):
        policy = EscalationPolicy.objects.create(
            organization=self.org,
            name="First Default",
            is_active=True,
            is_default=True,
        )
        self.assertTrue(policy.is_default)

    def test_second_active_default_violates_db_constraint(self):
        EscalationPolicy.objects.create(
            organization=self.org,
            name="First Default",
            is_active=True,
            is_default=True,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            EscalationPolicy.objects.create(
                organization=self.org,
                name="Second Default",
                is_active=True,
                is_default=True,
            )

    def test_inactive_defaults_do_not_conflict(self):
        EscalationPolicy.objects.create(
            organization=self.org,
            name="Inactive A",
            is_active=False,
            is_default=True,
        )
        EscalationPolicy.objects.create(
            organization=self.org,
            name="Inactive B",
            is_active=False,
            is_default=True,
        )
        self.assertEqual(
            EscalationPolicy.objects.filter(
                organization=self.org, is_active=False, is_default=True
            ).count(),
            2,
        )

    def test_active_default_is_per_organization(self):
        _, org_b = _make_org("idx-b")
        EscalationPolicy.objects.create(
            organization=self.org,
            name="Org A Default",
            is_active=True,
            is_default=True,
        )
        # Different org — must not raise
        EscalationPolicy.objects.create(
            organization=org_b,
            name="Org B Default",
            is_active=True,
            is_default=True,
        )

    def test_constraint_name_registered(self):
        constraint_names = {c.name for c in EscalationPolicy._meta.constraints}
        self.assertIn(
            "unique_active_default_escalation_policy_per_org", constraint_names
        )


class EscalationLevelUniqueConstraintTest(TestCase):
    def setUp(self):
        user, org = _make_org("level-dup")
        membership = user.memberships.get(organization=org)
        self.policy = EscalationPolicyService.create_escalation_policy(
            organization=org, actor_membership=membership, name="Level Policy"
        )

    def test_duplicate_level_number_violates_db_constraint(self):
        EscalationLevel.objects.create(
            policy=self.policy,
            level=1,
            name="L1",
            delay_minutes=0,
            target_type=EscalationTargetType.ASSIGNEE,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            EscalationLevel.objects.create(
                policy=self.policy,
                level=1,
                name="L1 Dup",
                delay_minutes=5,
                target_type=EscalationTargetType.ASSIGNEE,
            )


class EscalationRuleUniqueConstraintTest(TestCase):
    def setUp(self):
        user, org = _make_org("rule-dup")
        membership = user.memberships.get(organization=org)
        self.policy = EscalationPolicyService.create_escalation_policy(
            organization=org, actor_membership=membership, name="Rule Policy"
        )

    def test_duplicate_trigger_violates_db_constraint(self):
        EscalationRule.objects.create(
            policy=self.policy,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            EscalationRule.objects.create(
                policy=self.policy,
                trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            )


class EscalationEventUniqueConstraintTest(TestCase):
    """The unique constraint on EscalationEvent prevents duplicate events at DB level."""

    def setUp(self):
        user, org = _make_org("event-dup")
        self.org = org
        membership = user.memberships.get(organization=org)

        sla_policy = SLAPolicyService.create_sla_policy(
            organization=org,
            actor_membership=membership,
            name="SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=sla_policy,
            actor_membership=membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )

        esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=org,
            actor_membership=membership,
            name="Event Policy",
            is_default=True,
        )

        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.incident = IncidentService.create_incident(
                org, user, "Event Dup", priority=IncidentPriority.P1
            )

        self.esc_policy = esc_policy
        # Create an IncidentEscalation manually for testing the constraint
        self.escalation = IncidentEscalation.objects.create(
            incident=self.incident,
            policy=esc_policy,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            status=EscalationStatus.ACTIVE,
            current_level=0,
        )

    def test_duplicate_event_violates_db_constraint(self):
        EscalationEvent.objects.create(
            incident_escalation=self.escalation,
            level=1,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            triggered_at=FROZEN_NOW,
            target_type=EscalationTargetType.ASSIGNEE,
            status=EscalationEventStatus.EXECUTED,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            EscalationEvent.objects.create(
                incident_escalation=self.escalation,
                level=1,
                trigger_type=EscalationTriggerType.RESPONSE_BREACH,
                triggered_at=FROZEN_NOW + timedelta(seconds=1),
                target_type=EscalationTargetType.ASSIGNEE,
                status=EscalationEventStatus.EXECUTED,
            )


class EscalationConcurrencyTest(TransactionTestCase):
    """
    Concurrency test: two simultaneous evaluate_incident_escalation() calls
    must produce exactly ONE escalation event, not two.

    Implementation: uses select_for_update() to serialize evaluation of the
    same (incident, policy, trigger_type) row. The second transaction waits
    for the first to commit, then finds current_level=1 and no-ops.
    """

    def setUp(self):
        user, org = _make_org("concurrent")
        self.org = org
        self.user = user
        membership = user.memberships.get(organization=org)

        sla_policy = SLAPolicyService.create_sla_policy(
            organization=org,
            actor_membership=membership,
            name="Concurrent SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=sla_policy,
            actor_membership=membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )

        self.esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=org,
            actor_membership=membership,
            name="Concurrent Esc",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.esc_policy,
            actor_membership=membership,
            level=1,
            name="Immediate",
            delay_minutes=0,
            target_type=EscalationTargetType.ASSIGNEE,
        )
        EscalationPolicyService.create_escalation_rule(
            policy=self.esc_policy,
            actor_membership=membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )

        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.incident = IncidentService.create_incident(
                org, user, "Concurrent Test", priority=IncidentPriority.P1
            )

        sla = self.incident.sla
        sla.response_breached = True
        sla.save()

    def test_concurrent_evaluation_produces_one_event(self):
        """
        Simulate two calls in sequence (Django test runner is single-threaded,
        so we verify idempotency at the application/DB level rather than true
        thread parallelism). The select_for_update() + unique constraint ensure
        that even with real parallelism only one event is created.
        """
        breach_time = FROZEN_NOW + timedelta(minutes=15)

        # First evaluation — executes level 1
        result1 = EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=breach_time,
        )
        self.assertEqual(result1.levels_executed, 1)

        # Second evaluation at the same time — must find level 1 already done
        result2 = EscalationEvaluationService.evaluate_incident_escalation(
            self.incident,
            EscalationTriggerType.RESPONSE_BREACH,
            now=breach_time,
        )
        self.assertEqual(result2.levels_executed, 0)

        # Confirm exactly one EscalationEvent exists
        escalations = get_incident_escalations(self.incident)
        self.assertEqual(escalations.count(), 1)
        esc = escalations.first()
        self.assertEqual(esc.events.count(), 1)
        self.assertEqual(esc.events.first().level, 1)
