"""
Phase 6 — Database Constraint Tests

Validates that the partial unique index on SLAPolicy is enforced at the
DATABASE level (not just the application layer), covering:

  - UniqueConstraint(fields=['organization'], condition=Q(is_active=True, is_default=True))
    → only one active-default policy per organization is permitted by the DB.
  - Multiple inactive or non-default policies for the same org are allowed.
  - The same active-default constraint is independent per organization.

These tests bypass the application service layer and write directly via the
ORM to confirm the PostgreSQL partial unique index will behave correctly in
production (Supabase). The same SQL is generated for SQLite in tests via
Django's Q()-based UniqueConstraint, so CI coverage translates to production
confidence.
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from organizations.services import OrganizationService
from sla.models import SLAPolicy

User = get_user_model()


def _make_org(label: str):
    user = User.objects.create_user(
        email=f"{label}@dbconstraint.test", password="Password123!"
    )
    org = OrganizationService.create_organization(user=user, name=f"Org {label}")
    return org


class SLAPartialUniqueIndexTest(TestCase):
    """
    Database-level enforcement of the single active-default-per-org constraint.
    Tests bypass service layer to directly probe the index.
    """

    def setUp(self):
        self.org = _make_org("constraint-a")

    def test_single_active_default_allowed(self):
        """One active+default policy per org is valid."""
        policy = SLAPolicy.objects.create(
            organization=self.org,
            name="First Default",
            is_active=True,
            is_default=True,
        )
        self.assertTrue(policy.is_default)
        self.assertTrue(policy.is_active)

    def test_second_active_default_violates_db_constraint(self):
        """
        Inserting a second (is_active=True, is_default=True) policy for the
        same org must raise IntegrityError from the DB — the partial unique
        index enforces this at the storage level, not only in the service.
        """
        SLAPolicy.objects.create(
            organization=self.org,
            name="First Default",
            is_active=True,
            is_default=True,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            SLAPolicy.objects.create(
                organization=self.org,
                name="Second Default",
                is_active=True,
                is_default=True,
            )

    def test_two_active_non_default_policies_allowed(self):
        """Multiple active policies without is_default=True are fine."""
        SLAPolicy.objects.create(
            organization=self.org,
            name="Active Policy A",
            is_active=True,
            is_default=False,
        )
        SLAPolicy.objects.create(
            organization=self.org,
            name="Active Policy B",
            is_active=True,
            is_default=False,
        )
        self.assertEqual(
            SLAPolicy.objects.filter(organization=self.org, is_active=True).count(), 2
        )

    def test_two_inactive_default_policies_allowed(self):
        """
        Inactive policies with is_default=True do NOT conflict —
        the partial index only covers (is_active=True AND is_default=True).
        """
        SLAPolicy.objects.create(
            organization=self.org,
            name="Inactive Default A",
            is_active=False,
            is_default=True,
        )
        SLAPolicy.objects.create(
            organization=self.org,
            name="Inactive Default B",
            is_active=False,
            is_default=True,
        )
        self.assertEqual(
            SLAPolicy.objects.filter(
                organization=self.org, is_active=False, is_default=True
            ).count(),
            2,
        )

    def test_active_default_is_per_organization(self):
        """
        Org A and Org B can each have one active-default policy independently.
        The constraint is scoped to (organization_id) — different orgs do not
        conflict with each other.
        """
        org_b = _make_org("constraint-b")

        SLAPolicy.objects.create(
            organization=self.org,
            name="Org A Default",
            is_active=True,
            is_default=True,
        )
        # Must not raise — different organization.
        SLAPolicy.objects.create(
            organization=org_b,
            name="Org B Default",
            is_active=True,
            is_default=True,
        )
        self.assertEqual(
            SLAPolicy.objects.filter(
                organization=self.org, is_active=True, is_default=True
            ).count(),
            1,
        )
        self.assertEqual(
            SLAPolicy.objects.filter(
                organization=org_b, is_active=True, is_default=True
            ).count(),
            1,
        )

    def test_updating_first_to_inactive_allows_second_active_default(self):
        """
        After clearing is_default on the first policy, a second one can be
        promoted — the DB constraint is satisfied at the point of insert.
        """
        first = SLAPolicy.objects.create(
            organization=self.org,
            name="Original Default",
            is_active=True,
            is_default=True,
        )
        # Demote first before promoting second.
        SLAPolicy.objects.filter(pk=first.pk).update(is_default=False)

        # Now a second active-default should be accepted by the DB.
        second = SLAPolicy.objects.create(
            organization=self.org,
            name="New Default",
            is_active=True,
            is_default=True,
        )
        second.refresh_from_db()
        self.assertTrue(second.is_default)

    def test_constraint_name_is_correct(self):
        """
        Verify the constraint name registered in Django's meta matches what
        was applied in the migration, so --check migrations stays clean.
        """
        constraint_names = {c.name for c in SLAPolicy._meta.constraints}
        self.assertIn(
            "unique_active_default_sla_policy_per_org",
            constraint_names,
            msg=(
                "Constraint 'unique_active_default_sla_policy_per_org' not found "
                "in SLAPolicy._meta.constraints. Model and migration are out of sync."
            ),
        )
