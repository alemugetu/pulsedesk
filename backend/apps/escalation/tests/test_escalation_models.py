"""
Phase 7 — Escalation Model & Policy Service Tests

Validates:
- EscalationPolicy creation, update, organization scoping.
- Single active-default constraint per organization.
- EscalationLevel creation, duplicate level rejection, delay validation.
- ROLE target tenant isolation at service level.
- EscalationRule creation and duplicate rejection.
- Cross-org policy isolation at selector level.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from escalation.models import (
    EscalationTargetType,
    EscalationTriggerType,
)
from escalation.selectors import (
    get_default_escalation_policy,
    get_escalation_levels,
    get_escalation_policies,
)
from escalation.services import EscalationPolicyService, EscalationValidationError
from organizations.services import OrganizationService

User = get_user_model()


def _make_org(email_prefix: str):
    user = User.objects.create_user(
        email=f"{email_prefix}@esc.test", password="Password123!"
    )
    org = OrganizationService.create_organization(user=user, name=f"Org {email_prefix}")
    membership = user.memberships.get(organization=org)
    return user, org, membership


class EscalationPolicyCreationTest(TestCase):
    def setUp(self):
        self.user, self.org, self.membership = _make_org("policy-owner")

    def test_create_policy(self):
        policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Critical Escalation",
        )
        self.assertEqual(policy.organization, self.org)
        self.assertEqual(policy.name, "Critical Escalation")
        self.assertTrue(policy.is_active)
        self.assertFalse(policy.is_default)

    def test_create_default_policy(self):
        policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default Escalation",
            is_default=True,
        )
        self.assertTrue(policy.is_default)
        retrieved = get_default_escalation_policy(self.org)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, policy.id)

    def test_only_one_active_default_allowed(self):
        """Creating a second active default must demote the first."""
        first = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="First Default",
            is_default=True,
        )
        second = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Second Default",
            is_default=True,
        )
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_default)
        self.assertTrue(second.is_default)
        self.assertEqual(get_default_escalation_policy(self.org).id, second.id)

    def test_duplicate_name_rejected(self):
        EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Dup Name",
        )
        with self.assertRaises(EscalationValidationError):
            EscalationPolicyService.create_escalation_policy(
                organization=self.org,
                actor_membership=self.membership,
                name="Dup Name",
            )

    def test_inactive_policy_loses_default_flag(self):
        policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Going Inactive",
            is_default=True,
        )
        EscalationPolicyService.update_escalation_policy(
            policy=policy,
            actor_membership=self.membership,
            is_active=False,
        )
        policy.refresh_from_db()
        self.assertFalse(policy.is_active)
        self.assertFalse(policy.is_default)
        self.assertIsNone(get_default_escalation_policy(self.org))

    def test_filter_active_policies(self):
        EscalationPolicyService.create_escalation_policy(
            organization=self.org, actor_membership=self.membership, name="Active A"
        )
        p2 = EscalationPolicyService.create_escalation_policy(
            organization=self.org, actor_membership=self.membership, name="Inactive B"
        )
        EscalationPolicyService.update_escalation_policy(
            policy=p2, actor_membership=self.membership, is_active=False
        )
        active = get_escalation_policies(self.org, is_active=True)
        names = list(active.values_list("name", flat=True))
        self.assertIn("Active A", names)
        self.assertNotIn("Inactive B", names)

    def test_organization_scoping(self):
        _, other_org, other_membership = _make_org("other-esc")
        EscalationPolicyService.create_escalation_policy(
            organization=other_org,
            actor_membership=other_membership,
            name="Other Org Policy",
        )
        self.assertEqual(get_escalation_policies(self.org).count(), 0)

    def test_permission_denied_for_non_manager(self):
        """Viewer cannot create an escalation policy."""
        from organizations.models import Membership, MembershipStatus

        viewer_user = User.objects.create_user(
            email="viewer@esc.test", password="Password123!"
        )
        role = self.org.roles.get(slug="viewer")
        viewer_membership = Membership.objects.create(
            user=viewer_user,
            organization=self.org,
            role=role,
            status=MembershipStatus.ACTIVE,
        )
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_policy(
                organization=self.org,
                actor_membership=viewer_membership,
                name="Viewer Policy",
            )
        self.assertEqual(ctx.exception.code, "permission_denied")


class EscalationLevelCreationTest(TestCase):
    def setUp(self):
        self.user, self.org, self.membership = _make_org("level-owner")
        self.policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Test Policy",
        )

    def test_create_assignee_level(self):
        level = EscalationPolicyService.create_escalation_level(
            policy=self.policy,
            actor_membership=self.membership,
            level=1,
            name="First Responder",
            delay_minutes=0,
            target_type=EscalationTargetType.ASSIGNEE,
        )
        self.assertEqual(level.level, 1)
        self.assertEqual(level.delay_minutes, 0)
        self.assertEqual(level.target_type, EscalationTargetType.ASSIGNEE)
        self.assertEqual(level.target_reference, "")

    def test_create_role_level(self):
        role = self.org.roles.get(slug="operations-manager")
        level = EscalationPolicyService.create_escalation_level(
            policy=self.policy,
            actor_membership=self.membership,
            level=2,
            name="Ops Manager",
            delay_minutes=15,
            target_type=EscalationTargetType.ROLE,
            target_reference=str(role.id),
        )
        self.assertEqual(level.level, 2)
        self.assertEqual(level.target_type, EscalationTargetType.ROLE)
        self.assertEqual(level.target_reference, str(role.id))

    def test_duplicate_level_number_rejected(self):
        EscalationPolicyService.create_escalation_level(
            policy=self.policy,
            actor_membership=self.membership,
            level=1,
            name="Level 1",
            target_type=EscalationTargetType.ASSIGNEE,
        )
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy,
                actor_membership=self.membership,
                level=1,
                name="Level 1 Dup",
                target_type=EscalationTargetType.ASSIGNEE,
            )
        self.assertEqual(ctx.exception.code, "duplicate_level")

    def test_negative_delay_rejected(self):
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy,
                actor_membership=self.membership,
                level=1,
                name="Bad Delay",
                delay_minutes=-5,
                target_type=EscalationTargetType.ASSIGNEE,
            )
        self.assertEqual(ctx.exception.code, "invalid_delay")

    def test_level_zero_rejected(self):
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy,
                actor_membership=self.membership,
                level=0,
                name="Bad Level",
                target_type=EscalationTargetType.ASSIGNEE,
            )
        self.assertEqual(ctx.exception.code, "invalid_level")

    def test_role_target_without_reference_rejected(self):
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy,
                actor_membership=self.membership,
                level=1,
                name="No Role Ref",
                target_type=EscalationTargetType.ROLE,
                target_reference="",
            )
        self.assertEqual(ctx.exception.code, "missing_role_reference")

    def test_cross_tenant_role_reference_rejected(self):
        """A role from a different organization must be rejected."""
        _, other_org, _ = _make_org("cross-tenant-esc")
        other_role = other_org.roles.get(slug="agent")
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy,
                actor_membership=self.membership,
                level=1,
                name="Cross Tenant",
                target_type=EscalationTargetType.ROLE,
                target_reference=str(other_role.id),
            )
        self.assertEqual(ctx.exception.code, "invalid_role_reference")

    def test_levels_ordered(self):
        for i in [3, 1, 2]:
            EscalationPolicyService.create_escalation_level(
                policy=self.policy,
                actor_membership=self.membership,
                level=i,
                name=f"Level {i}",
                delay_minutes=i * 10,
                target_type=EscalationTargetType.ASSIGNEE,
            )
        levels = list(get_escalation_levels(self.policy))
        self.assertEqual([lvl.level for lvl in levels], [1, 2, 3])


class EscalationRuleCreationTest(TestCase):
    def setUp(self):
        self.user, self.org, self.membership = _make_org("rule-owner")
        self.policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Rule Test Policy",
        )

    def test_create_response_breach_rule(self):
        rule = EscalationPolicyService.create_escalation_rule(
            policy=self.policy,
            actor_membership=self.membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )
        self.assertEqual(rule.trigger_type, EscalationTriggerType.RESPONSE_BREACH)
        self.assertTrue(rule.is_active)

    def test_create_resolution_breach_rule(self):
        rule = EscalationPolicyService.create_escalation_rule(
            policy=self.policy,
            actor_membership=self.membership,
            trigger_type=EscalationTriggerType.RESOLUTION_BREACH,
        )
        self.assertEqual(rule.trigger_type, EscalationTriggerType.RESOLUTION_BREACH)

    def test_duplicate_trigger_type_rejected(self):
        EscalationPolicyService.create_escalation_rule(
            policy=self.policy,
            actor_membership=self.membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH,
        )
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_rule(
                policy=self.policy,
                actor_membership=self.membership,
                trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            )
        self.assertEqual(ctx.exception.code, "duplicate_rule")

    def test_invalid_trigger_type_rejected(self):
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_rule(
                policy=self.policy,
                actor_membership=self.membership,
                trigger_type="INVALID_TRIGGER",
            )
        self.assertEqual(ctx.exception.code, "invalid_trigger_type")

    def test_cross_tenant_rule_creation_rejected(self):
        _, _, other_membership = _make_org("rule-cross-tenant")
        with self.assertRaises(EscalationValidationError) as ctx:
            EscalationPolicyService.create_escalation_rule(
                policy=self.policy,  # belongs to self.org
                actor_membership=other_membership,  # belongs to other_org
                trigger_type=EscalationTriggerType.RESPONSE_BREACH,
            )
        self.assertEqual(ctx.exception.code, "cross_tenant")
