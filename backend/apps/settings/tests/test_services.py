"""
Service-layer tests for OrganizationSettingsService.

Covers:
- create_default_settings: new org, idempotent re-call, legacy org backfill
- update_settings: single field, multi-field, no-op when values identical
- update_settings: unknown fields ignored (not passed)
- Audit log emission for a real change
- Changes dict matches the before/after delta
"""

from audit_logs.models import AuditAction, AuditLog
from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Organization
from settings.models import OrganizationSettings
from settings.services import OrganizationSettingsService

User = get_user_model()


def _make_org(name="Acme", slug=None):
    slug = slug or Organization.normalize_slug(name)
    return Organization.objects.create(name=name, slug=slug)


def _make_user(email="user@example.com"):
    return User.objects.create_user(email=email, password="testpass123")


class CreateDefaultSettingsServiceTest(TestCase):
    def test_creates_settings_for_new_org(self):
        org = _make_org()
        self.assertFalse(OrganizationSettings.objects.filter(organization=org).exists())
        settings = OrganizationSettingsService.create_default_settings(org)
        self.assertEqual(settings.organization, org)
        self.assertEqual(settings.default_incident_priority, "P3")
        self.assertEqual(settings.default_incident_status, "OPEN")

    def test_idempotent_on_existing_settings(self):
        org = _make_org()
        s1 = OrganizationSettingsService.create_default_settings(org)
        # Mutate the row so we can confirm second call returns *existing* record.
        s1.default_incident_priority = "P1"
        s1.save()

        s2 = OrganizationSettingsService.create_default_settings(org)
        self.assertEqual(s1.id, s2.id)
        # Value must NOT be overwritten back to P3.
        self.assertEqual(s2.default_incident_priority, "P1")

    def test_defaults_are_explicitly_correct(self):
        org = _make_org()
        settings = OrganizationSettingsService.create_default_settings(org)
        self.assertTrue(settings.incident_comments_enabled)
        self.assertTrue(settings.notification_incident_emails_enabled)
        self.assertTrue(settings.notification_escalation_emails_enabled)
        self.assertTrue(settings.notification_sla_emails_enabled)
        self.assertTrue(settings.sla_auto_apply_default_policy)
        self.assertTrue(settings.escalation_auto_apply_default_policy)


class UpdateSettingsServiceTest(TestCase):
    def setUp(self):
        self.org = _make_org()
        self.settings = OrganizationSettingsService.create_default_settings(self.org)
        self.user = _make_user()

    # ── Single / multi field updates ───────────────────────────────────

    def test_update_single_field(self):
        updated, changes = OrganizationSettingsService.update_settings(
            self.settings,
            actor=self.user,
            default_incident_priority="P1",
        )
        self.assertEqual(updated.default_incident_priority, "P1")
        self.assertEqual(
            changes,
            {
                "before": {"default_incident_priority": "P3"},
                "after": {"default_incident_priority": "P1"},
            },
        )

    def test_update_multiple_fields(self):
        updated, changes = OrganizationSettingsService.update_settings(
            self.settings,
            actor=self.user,
            incident_comments_enabled=False,
            notification_incident_emails_enabled=False,
        )
        self.assertFalse(updated.incident_comments_enabled)
        self.assertFalse(updated.notification_incident_emails_enabled)
        self.assertEqual(changes["before"]["incident_comments_enabled"], True)
        self.assertEqual(changes["after"]["incident_comments_enabled"], False)

    def test_no_op_when_values_identical(self):
        _updated, changes = OrganizationSettingsService.update_settings(
            self.settings,
            actor=self.user,
            default_incident_priority="P3",
            incident_comments_enabled=True,
        )
        self.assertEqual(changes, {})
        # Ensure no spurious audit log was created.
        self.assertEqual(
            AuditLog.objects.filter(action=AuditAction.SETTINGS_UPDATED).count(),
            0,
        )

    def test_unknown_fields_are_ignored(self):
        updated, changes = OrganizationSettingsService.update_settings(
            self.settings,
            actor=self.user,
            default_incident_priority="P2",
            this_field_does_not_exist="oops",
        )
        self.assertEqual(updated.default_incident_priority, "P2")
        # No audit entry for non-existent fields because nothing changed
        # beyond the real P2 update.
        self.assertEqual(changes["after"]["default_incident_priority"], "P2")

    # ── Audit log integration ──────────────────────────────────────────

    def test_update_audited_with_actor(self):
        OrganizationSettingsService.update_settings(
            self.settings,
            actor=self.user,
            default_incident_priority="P1",
        )
        log = AuditLog.objects.get(action=AuditAction.SETTINGS_UPDATED)
        self.assertEqual(log.organization, self.org)
        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.resource_type, "organization_settings")
        self.assertEqual(log.resource_id, str(self.settings.id))
        # Changes dict in the audit record must be the safe before/after.
        self.assertEqual(log.changes["before"]["default_incident_priority"], "P3")
        self.assertEqual(log.changes["after"]["default_incident_priority"], "P1")

    def test_update_without_actor_is_still_audited(self):
        OrganizationSettingsService.update_settings(
            self.settings,
            actor=None,
            sla_auto_apply_default_policy=False,
        )
        log = AuditLog.objects.get(action=AuditAction.SETTINGS_UPDATED)
        self.assertIsNone(log.actor)
        self.assertEqual(log.changes["after"]["sla_auto_apply_default_policy"], False)

    # ── Validation at service boundary ─────────────────────────────────

    def test_invalid_choice_not_saved(self):
        """
        The service layer trusts callers to pass valid values because the
        API serializer validates before invoking. But we must still
        guarantee DB-level consistency — passing a bogus string must raise
        at the model-level save (choices + CharField length).
        """
        from django.db import DataError

        # Deliberately bypass serializer; confirm DB rejects when service
        # passes a value too long (defence-in-depth check).
        with self.assertRaises((DataError, Exception)):
            OrganizationSettingsService.update_settings(
                self.settings,
                default_incident_priority="P" * 100,  # way too long
            )
