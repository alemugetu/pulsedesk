"""
Model tests for OrganizationSettings.

Covers:
- OneToOne relationship with Organization (at most one per org)
- Default field values
- Timestamps (created_at, updated_at)
- Organization cascade delete (settings must vanish with org)
- Backfill for existing orgs (migration-created legacy records)
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from organizations.models import Organization
from organizations.services import OrganizationService
from settings.models import OrganizationSettings
from settings.selectors import get_settings_for_organization

User = get_user_model()


def _make_org(name="Acme", slug=None):
    slug = slug or Organization.normalize_slug(name)
    return Organization.objects.create(name=name, slug=slug)


def _make_user(email="user@example.com"):
    return User.objects.create_user(email=email, password="testpass123")


class OrganizationSettingsModelTest(TestCase):
    """Direct model-level tests for OrganizationSettings."""

    def setUp(self):
        self.user = _make_user()
        self.org = _make_org()

    # ── Creation & defaults ───────────────────────────────────────────

    def test_create_settings_for_org(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertEqual(settings.organization, self.org)
        self.assertIsNotNone(settings.id)

    def test_default_priority_is_p3(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertEqual(settings.default_incident_priority, "P3")

    def test_default_status_is_open(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertEqual(settings.default_incident_status, "OPEN")

    def test_default_comments_enabled(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertTrue(settings.incident_comments_enabled)

    def test_default_notification_email_toggles_are_true(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertTrue(settings.notification_incident_emails_enabled)
        self.assertTrue(settings.notification_escalation_emails_enabled)
        self.assertTrue(settings.notification_sla_emails_enabled)

    def test_default_sla_and_escalation_policies_auto_apply(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertTrue(settings.sla_auto_apply_default_policy)
        self.assertTrue(settings.escalation_auto_apply_default_policy)

    def test_timestamps_are_populated(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertIsNotNone(settings.created_at)
        self.assertIsNotNone(settings.updated_at)

    # ── OneToOne uniqueness enforcement ────────────────────────────────

    def test_one_settings_record_per_org(self):
        OrganizationSettings.objects.create(organization=self.org)
        with self.assertRaises(IntegrityError):
            OrganizationSettings.objects.create(organization=self.org)

    # ── Cascade delete ─────────────────────────────────────────────────

    def test_settings_deleted_when_org_deleted(self):
        OrganizationSettings.objects.create(organization=self.org)
        self.assertEqual(OrganizationSettings.objects.count(), 1)
        self.org.delete()
        self.assertEqual(OrganizationSettings.objects.count(), 0)

    # ── Reverse accessor from Organization.settings ────────────────────

    def test_organization_reverse_accessor(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.org.refresh_from_db()
        self.assertEqual(self.org.settings, settings)

    def test_org_without_settings_reverse_raises_does_not_exist(self):
        # Direct ORM access (no lazy selector) → DoesNotExist for legacy org.
        with self.assertRaises(OrganizationSettings.DoesNotExist):
            _ = self.org.settings

    def test_get_settings_for_organization_backfills_legacy_org(self):
        # org has no settings row (created via _make_org without service).
        self.assertFalse(
            OrganizationSettings.objects.filter(organization=self.org).exists()
        )
        settings = get_settings_for_organization(self.org)
        self.assertIsNotNone(settings)
        self.assertEqual(settings.organization, self.org)
        # Second call must be idempotent.
        settings2 = get_settings_for_organization(self.org)
        self.assertEqual(settings.id, settings2.id)

    # ── Service-created org has settings automatically ─────────────────

    def test_organization_service_creates_settings(self):
        user = _make_user("new@example.com")
        org = OrganizationService.create_organization(user, name="NewOrg")
        self.assertTrue(
            OrganizationSettings.objects.filter(organization=org).exists()
        )
        settings = OrganizationSettings.objects.get(organization=org)
        self.assertEqual(settings.default_incident_priority, "P3")

    # ── str() representation ───────────────────────────────────────────

    def test_str_representation(self):
        settings = OrganizationSettings.objects.create(organization=self.org)
        self.assertIn(str(self.org.id), str(settings))
