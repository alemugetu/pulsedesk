"""
Phase 6 — SLA Calculation Tests

Validates:
- Deadline calculation accuracy (timezone-aware).
- evaluate_sla_status() breach logic with frozen time.
- Completed SLAs are never retroactively breached.
- ON_TRACK / BREACHED / COMPLETED status derivation.
- No SLA record created when no active default policy exists.
- SLA graceful degradation on incident creation without policy.
"""

from datetime import timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from incidents.models import IncidentPriority, IncidentStatus
from incidents.services import IncidentService
from organizations.services import OrganizationService
from sla.models import SLAStatus
from sla.selectors import get_incident_sla
from sla.services import SLACalculationService, SLAPolicyService

User = get_user_model()

FROZEN_NOW = timezone.datetime(2026, 1, 15, 10, 0, 0, tzinfo=dt_timezone.utc)


def _make_org_with_sla(email_prefix: str, priority=IncidentPriority.P1):
    """
    Helper: create org, owner, default SLA policy with a P1 target
    (response=15m, resolution=60m), and return (user, org, membership).
    """
    user = User.objects.create_user(
        email=f"{email_prefix}@calc.test", password="Password123!"
    )
    org = OrganizationService.create_organization(
        user=user, name=f"SLA Org {email_prefix}"
    )
    membership = user.memberships.get(organization=org)

    policy = SLAPolicyService.create_sla_policy(
        organization=org,
        actor_membership=membership,
        name="Default Production SLA",
        is_active=True,
        is_default=True,
    )
    SLAPolicyService.create_sla_target(
        policy=policy,
        actor_membership=membership,
        priority=IncidentPriority.P1,
        response_time_minutes=15,
        resolution_time_minutes=60,
    )
    SLAPolicyService.create_sla_target(
        policy=policy,
        actor_membership=membership,
        priority=IncidentPriority.P2,
        response_time_minutes=30,
        resolution_time_minutes=240,
    )
    SLAPolicyService.create_sla_target(
        policy=policy,
        actor_membership=membership,
        priority=IncidentPriority.P3,
        response_time_minutes=60,
        resolution_time_minutes=480,
    )
    SLAPolicyService.create_sla_target(
        policy=policy,
        actor_membership=membership,
        priority=IncidentPriority.P4,
        response_time_minutes=240,
        resolution_time_minutes=1440,
    )
    return user, org, membership


class SLADeadlineCalculationTest(TestCase):
    """Test that deadlines are calculated correctly from incident creation time."""

    def test_p1_deadlines(self):
        """P1: response=15m, resolution=60m from creation time."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _ = _make_org_with_sla("calc-p1")
            incident = IncidentService.create_incident(
                org, user, "P1 Critical", priority=IncidentPriority.P1
            )

        sla = get_incident_sla(incident)
        self.assertIsNotNone(sla, "SLA record must be created for P1.")
        expected_response = FROZEN_NOW + timedelta(minutes=15)
        expected_resolution = FROZEN_NOW + timedelta(minutes=60)
        self.assertEqual(sla.response_deadline, expected_response)
        self.assertEqual(sla.resolution_deadline, expected_resolution)

    def test_p2_deadlines(self):
        """P2: response=30m, resolution=240m."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _ = _make_org_with_sla("calc-p2")
            incident = IncidentService.create_incident(
                org, user, "P2 High", priority=IncidentPriority.P2
            )

        sla = get_incident_sla(incident)
        self.assertIsNotNone(sla)
        self.assertEqual(sla.response_deadline, FROZEN_NOW + timedelta(minutes=30))
        self.assertEqual(sla.resolution_deadline, FROZEN_NOW + timedelta(minutes=240))

    def test_p3_deadlines(self):
        """P3: response=60m, resolution=480m."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _ = _make_org_with_sla("calc-p3")
            incident = IncidentService.create_incident(
                org, user, "P3 Medium", priority=IncidentPriority.P3
            )

        sla = get_incident_sla(incident)
        self.assertIsNotNone(sla)
        self.assertEqual(sla.response_deadline, FROZEN_NOW + timedelta(minutes=60))
        self.assertEqual(sla.resolution_deadline, FROZEN_NOW + timedelta(minutes=480))

    def test_p4_deadlines(self):
        """P4: response=240m, resolution=1440m."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _ = _make_org_with_sla("calc-p4")
            incident = IncidentService.create_incident(
                org, user, "P4 Low", priority=IncidentPriority.P4
            )

        sla = get_incident_sla(incident)
        self.assertIsNotNone(sla)
        self.assertEqual(sla.response_deadline, FROZEN_NOW + timedelta(minutes=240))
        self.assertEqual(sla.resolution_deadline, FROZEN_NOW + timedelta(minutes=1440))

    def test_deadlines_are_timezone_aware(self):
        """Both deadlines must be timezone-aware datetimes."""
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            user, org, _ = _make_org_with_sla("calc-tz")
            incident = IncidentService.create_incident(
                org, user, "TZ Test", priority=IncidentPriority.P1
            )

        sla = get_incident_sla(incident)
        self.assertIsNotNone(sla.response_deadline.tzinfo)
        self.assertIsNotNone(sla.resolution_deadline.tzinfo)


class SLAGracefulDegradationTest(TestCase):
    """Incident creation must succeed even without a configured SLA policy."""

    def test_no_sla_record_when_no_policy(self):
        user = User.objects.create_user(
            email="no-sla@calc.test", password="Password123!"
        )
        org = OrganizationService.create_organization(user=user, name="No SLA Org")
        # No SLA policy created — org has no active default policy.
        incident = IncidentService.create_incident(org, user, "No Policy Incident")
        self.assertIsNone(get_incident_sla(incident))

    def test_no_sla_when_policy_has_no_matching_target(self):
        """Policy exists but no target for the incident's priority."""
        user = User.objects.create_user(
            email="partial-sla@calc.test", password="Password123!"
        )
        org = OrganizationService.create_organization(user=user, name="Partial SLA Org")
        membership = user.memberships.get(organization=org)
        policy = SLAPolicyService.create_sla_policy(
            organization=org,
            actor_membership=membership,
            name="Partial Policy",
            is_default=True,
        )
        # Only create target for P1 — incident will be P3.
        SLAPolicyService.create_sla_target(
            policy=policy,
            actor_membership=membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )
        incident = IncidentService.create_incident(
            org, user, "P3 No Target", priority=IncidentPriority.P3
        )
        self.assertIsNone(get_incident_sla(incident))


class SLABreachEvaluationTest(TestCase):
    """Test evaluate_sla_status() with deterministic frozen time."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership = _make_org_with_sla("breach")
            self.incident = IncidentService.create_incident(
                self.org, self.user, "Breach Test", priority=IncidentPriority.P1
            )
        self.sla = get_incident_sla(self.incident)
        self.assertIsNotNone(self.sla)
        # P1: response_deadline = 10:15, resolution_deadline = 11:00

    def test_on_track_before_deadlines(self):
        """Before any deadline → ON_TRACK for both."""
        before_deadline = FROZEN_NOW + timedelta(minutes=10)  # 10:10
        sla = SLACalculationService.evaluate_sla_status(self.sla, now=before_deadline)
        self.assertFalse(sla.response_breached)
        self.assertFalse(sla.resolution_breached)
        self.assertEqual(
            SLACalculationService.get_response_sla_status(
                self.sla, now=before_deadline
            ),
            SLAStatus.ON_TRACK,
        )
        self.assertEqual(
            SLACalculationService.get_resolution_sla_status(
                self.sla, now=before_deadline
            ),
            SLAStatus.ON_TRACK,
        )

    def test_response_breached_after_response_deadline(self):
        """After response_deadline (10:15), response is breached."""
        after_response = FROZEN_NOW + timedelta(minutes=20)  # 10:20
        sla = SLACalculationService.evaluate_sla_status(self.sla, now=after_response)
        sla.refresh_from_db()
        self.assertTrue(sla.response_breached)
        self.assertFalse(sla.resolution_breached)
        self.assertEqual(
            SLACalculationService.get_response_sla_status(self.sla, now=after_response),
            SLAStatus.BREACHED,
        )
        self.assertEqual(
            SLACalculationService.get_resolution_sla_status(
                self.sla, now=after_response
            ),
            SLAStatus.ON_TRACK,
        )

    def test_both_breached_after_resolution_deadline(self):
        """After resolution_deadline (11:00), both are breached."""
        after_both = FROZEN_NOW + timedelta(minutes=70)  # 11:10
        sla = SLACalculationService.evaluate_sla_status(self.sla, now=after_both)
        sla.refresh_from_db()
        self.assertTrue(sla.response_breached)
        self.assertTrue(sla.resolution_breached)
        self.assertEqual(
            SLACalculationService.get_response_sla_status(self.sla, now=after_both),
            SLAStatus.BREACHED,
        )
        self.assertEqual(
            SLACalculationService.get_resolution_sla_status(self.sla, now=after_both),
            SLAStatus.BREACHED,
        )

    def test_completed_sla_not_retroactively_breached(self):
        """If completed_at is set, must not be marked breached regardless of time."""
        after_deadline = FROZEN_NOW + timedelta(minutes=70)  # well past both deadlines
        # Manually set completed times (simulating service call)
        self.sla.response_completed_at = FROZEN_NOW + timedelta(minutes=5)
        self.sla.resolution_completed_at = FROZEN_NOW + timedelta(minutes=50)
        self.sla.save()

        sla = SLACalculationService.evaluate_sla_status(self.sla, now=after_deadline)
        sla.refresh_from_db()
        self.assertFalse(sla.response_breached)
        self.assertFalse(sla.resolution_breached)
        self.assertEqual(
            SLACalculationService.get_response_sla_status(self.sla, now=after_deadline),
            SLAStatus.COMPLETED,
        )
        self.assertEqual(
            SLACalculationService.get_resolution_sla_status(
                self.sla, now=after_deadline
            ),
            SLAStatus.COMPLETED,
        )


class SLACompletionOnTransitionTest(TestCase):
    """Test that workflow transitions correctly mark SLA completions."""

    def setUp(self):
        with patch("django.utils.timezone.now", return_value=FROZEN_NOW):
            self.user, self.org, self.membership = _make_org_with_sla("completion")
            self.incident = IncidentService.create_incident(
                self.org, self.user, "SLA Completion", priority=IncidentPriority.P1
            )
        self.sla = get_incident_sla(self.incident)
        self.assertIsNotNone(self.sla)

    def test_acknowledged_sets_response_completed_at(self):
        ack_time = FROZEN_NOW + timedelta(minutes=10)
        with patch("django.utils.timezone.now", return_value=ack_time):
            IncidentService.transition_incident_status(
                self.incident,
                self.membership,
                IncidentStatus.ACKNOWLEDGED,
            )
        self.sla.refresh_from_db()
        self.assertIsNotNone(self.sla.response_completed_at)
        self.assertIsNone(self.sla.resolution_completed_at)

    def test_resolved_sets_resolution_completed_at(self):
        # Walk through to RESOLVED
        ack_time = FROZEN_NOW + timedelta(minutes=10)
        with patch("django.utils.timezone.now", return_value=ack_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.ACKNOWLEDGED
            )
        ip_time = FROZEN_NOW + timedelta(minutes=20)
        with patch("django.utils.timezone.now", return_value=ip_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.IN_PROGRESS
            )
        resolve_time = FROZEN_NOW + timedelta(minutes=50)
        with patch("django.utils.timezone.now", return_value=resolve_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.RESOLVED
            )
        self.sla.refresh_from_db()
        self.assertIsNotNone(self.sla.resolution_completed_at)

    def test_response_sla_status_completed_after_acknowledged(self):
        ack_time = FROZEN_NOW + timedelta(minutes=10)
        with patch("django.utils.timezone.now", return_value=ack_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.ACKNOWLEDGED
            )
        self.sla.refresh_from_db()
        # Even if we check after deadline, it must still be COMPLETED.
        future = FROZEN_NOW + timedelta(hours=5)
        self.assertEqual(
            SLACalculationService.get_response_sla_status(self.sla, now=future),
            SLAStatus.COMPLETED,
        )

    def test_resolution_sla_status_completed_after_resolved(self):
        ack_time = FROZEN_NOW + timedelta(minutes=10)
        ip_time = FROZEN_NOW + timedelta(minutes=20)
        resolve_time = FROZEN_NOW + timedelta(minutes=55)
        with patch("django.utils.timezone.now", return_value=ack_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.ACKNOWLEDGED
            )
        with patch("django.utils.timezone.now", return_value=ip_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.IN_PROGRESS
            )
        with patch("django.utils.timezone.now", return_value=resolve_time):
            IncidentService.transition_incident_status(
                self.incident, self.membership, IncidentStatus.RESOLVED
            )
        self.sla.refresh_from_db()
        future = FROZEN_NOW + timedelta(hours=10)
        self.assertEqual(
            SLACalculationService.get_resolution_sla_status(self.sla, now=future),
            SLAStatus.COMPLETED,
        )

    def test_no_sla_incident_transitions_work_normally(self):
        """Incidents without SLA must transition without errors."""
        user = User.objects.create_user(
            email="no-sla-transition@calc.test", password="Password123!"
        )
        org = OrganizationService.create_organization(
            user=user, name="No SLA Trans Org"
        )
        membership = user.memberships.get(organization=org)
        incident = IncidentService.create_incident(org, user, "No SLA")
        self.assertIsNone(get_incident_sla(incident))
        # Should not raise
        IncidentService.transition_incident_status(
            incident, membership, IncidentStatus.ACKNOWLEDGED
        )
        self.assertEqual(incident.status, IncidentStatus.ACKNOWLEDGED)
