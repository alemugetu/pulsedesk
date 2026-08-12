"""
Phase 6 — SLA Model Tests

Validates:
- SLAPolicy creation and organization ownership.
- SLATarget creation and priority uniqueness constraint.
- Default policy behavior (only one active-default per org).
- Active/inactive policy filtering.
- Cross-org isolation at model level.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from incidents.models import IncidentPriority
from organizations.services import OrganizationService
from sla.selectors import get_default_sla_policy, get_sla_policies, get_sla_target
from sla.services import SLAPolicyService

User = get_user_model()


def _make_org(email_prefix: str):
    user = User.objects.create_user(
        email=f"{email_prefix}@sla.test", password="Password123!"
    )
    org = OrganizationService.create_organization(user=user, name=f"Org {email_prefix}")
    membership = user.memberships.get(organization=org)
    return user, org, membership


class SLAPolicyCreationTest(TestCase):
    def setUp(self):
        self.user, self.org, self.membership = _make_org("policy-owner")

    def test_create_policy(self):
        policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Standard SLA",
        )
        self.assertEqual(policy.organization, self.org)
        self.assertEqual(policy.name, "Standard SLA")
        self.assertTrue(policy.is_active)
        self.assertFalse(policy.is_default)

    def test_create_default_policy(self):
        policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default SLA",
            is_default=True,
        )
        self.assertTrue(policy.is_default)
        retrieved = get_default_sla_policy(self.org)
        self.assertEqual(retrieved.id, policy.id)

    def test_only_one_active_default_allowed(self):
        """Creating a second active default must demote the first."""
        first = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="First Default",
            is_default=True,
        )
        second = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Second Default",
            is_default=True,
        )
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_default, "First policy should no longer be default.")
        self.assertTrue(second.is_default)
        default = get_default_sla_policy(self.org)
        self.assertEqual(default.id, second.id)

    def test_duplicate_name_rejected(self):
        from sla.services import SLAValidationError

        SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Duplicate Name",
        )
        with self.assertRaises(SLAValidationError):
            SLAPolicyService.create_sla_policy(
                organization=self.org,
                actor_membership=self.membership,
                name="Duplicate Name",
            )

    def test_inactive_policy_is_not_default(self):
        """Deactivating a default policy must clear its default flag."""
        policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Going Inactive",
            is_default=True,
        )
        SLAPolicyService.update_sla_policy(
            policy=policy,
            actor_membership=self.membership,
            is_active=False,
        )
        policy.refresh_from_db()
        self.assertFalse(policy.is_active)
        self.assertFalse(policy.is_default)
        self.assertIsNone(get_default_sla_policy(self.org))

    def test_filter_active_policies(self):
        SLAPolicyService.create_sla_policy(
            organization=self.org, actor_membership=self.membership, name="Active 1"
        )
        p2 = SLAPolicyService.create_sla_policy(
            organization=self.org, actor_membership=self.membership, name="Inactive 1"
        )
        SLAPolicyService.update_sla_policy(
            policy=p2, actor_membership=self.membership, is_active=False
        )
        active = get_sla_policies(self.org, is_active=True)
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().name, "Active 1")

    def test_organization_scoping(self):
        _, other_org, other_membership = _make_org("other-policy")
        SLAPolicyService.create_sla_policy(
            organization=other_org,
            actor_membership=other_membership,
            name="Other Org Policy",
        )
        policies_for_self = get_sla_policies(self.org)
        self.assertEqual(policies_for_self.count(), 0)


class SLATargetCreationTest(TestCase):
    def setUp(self):
        self.user, self.org, self.membership = _make_org("target-owner")
        self.policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Test Policy",
        )

    def test_create_target(self):
        target = SLAPolicyService.create_sla_target(
            policy=self.policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P1,
            response_time_minutes=15,
            resolution_time_minutes=60,
        )
        self.assertEqual(target.priority, IncidentPriority.P1)
        self.assertEqual(target.response_time_minutes, 15)
        self.assertEqual(target.resolution_time_minutes, 60)

    def test_duplicate_priority_rejected(self):
        from sla.services import SLAValidationError

        SLAPolicyService.create_sla_target(
            policy=self.policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P1,
            resolution_time_minutes=60,
            response_time_minutes=15,
        )
        with self.assertRaises(SLAValidationError):
            SLAPolicyService.create_sla_target(
                policy=self.policy,
                actor_membership=self.membership,
                priority=IncidentPriority.P1,
                response_time_minutes=20,
                resolution_time_minutes=90,
            )

    def test_resolution_less_than_response_rejected(self):
        from sla.services import SLAValidationError

        with self.assertRaises(SLAValidationError):
            SLAPolicyService.create_sla_target(
                policy=self.policy,
                actor_membership=self.membership,
                priority=IncidentPriority.P2,
                response_time_minutes=60,
                resolution_time_minutes=30,  # less than response
            )

    def test_all_four_priorities_can_be_created(self):
        configs = [
            (IncidentPriority.P1, 15, 60),
            (IncidentPriority.P2, 30, 240),
            (IncidentPriority.P3, 60, 480),
            (IncidentPriority.P4, 240, 1440),
        ]
        for priority, response, resolution in configs:
            SLAPolicyService.create_sla_target(
                policy=self.policy,
                actor_membership=self.membership,
                priority=priority,
                response_time_minutes=response,
                resolution_time_minutes=resolution,
            )
        self.assertEqual(self.policy.targets.count(), 4)

    def test_get_sla_target_selector(self):
        SLAPolicyService.create_sla_target(
            policy=self.policy,
            actor_membership=self.membership,
            priority=IncidentPriority.P3,
            response_time_minutes=60,
            resolution_time_minutes=480,
        )
        target = get_sla_target(self.policy, IncidentPriority.P3)
        self.assertIsNotNone(target)
        self.assertEqual(target.priority, IncidentPriority.P3)

    def test_get_sla_target_missing_returns_none(self):
        target = get_sla_target(self.policy, IncidentPriority.P1)
        self.assertIsNone(target)
