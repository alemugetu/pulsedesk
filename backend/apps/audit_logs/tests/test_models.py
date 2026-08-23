"""
Tests for the AuditLog model.

Covers:
- Valid record creation and field persistence
- Organization / actor relationships
- resource_type + resource_id tracking
- changes JSON field
- Timestamp from BaseModel
- String representation
- Immutability: save() blocks updates to existing records
- Immutability: delete() blocks application-level deletion
- System actor (actor=None) stored as NULL
- Cascade delete when organization is deleted
"""

import uuid

from audit_logs.models import AuditAction, AuditLog
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from organizations.services import OrganizationService

User = get_user_model()


def _make_user(email="actor@example.com"):
    return User.objects.create_user(email=email, password="Password123!")


class AuditLogModelTest(TestCase):
    def setUp(self):
        self.user = _make_user()
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )

    # ------------------------------------------------------------------
    # Field persistence
    # ------------------------------------------------------------------

    def test_valid_audit_log_creation(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
            changes={"title": "First incident", "priority": "P3"},
        )
        self.assertIsNotNone(log.id)
        self.assertIsInstance(log.id, uuid.UUID)
        self.assertEqual(log.organization, self.org)
        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.action, AuditAction.INCIDENT_CREATED)
        self.assertEqual(log.resource_type, "incident")
        self.assertEqual(log.changes["title"], "First incident")
        self.assertIsNotNone(log.created_at)

    def test_organization_relationship(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
            resource_id=str(uuid.uuid4()),
        )
        self.assertEqual(log.organization.id, self.org.id)

    def test_actor_relationship(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.ROLE_ASSIGNED,
            resource_type="membership",
            resource_id=str(uuid.uuid4()),
        )
        self.assertEqual(log.actor.email, self.user.email)

    def test_system_actor_stored_as_null(self):
        """System-generated events have actor=None (NULL in DB)."""
        log = AuditLog.objects.create(
            organization=self.org,
            actor=None,
            action=AuditAction.SLA_BREACHED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        self.assertIsNone(log.actor)

    def test_changes_json_field_default_empty_dict(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        self.assertEqual(log.changes, {})

    def test_ip_address_stored_when_provided(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
            ip_address="192.168.1.1",
        )
        self.assertEqual(log.ip_address, "192.168.1.1")

    def test_ip_address_null_by_default(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        self.assertIsNone(log.ip_address)

    def test_str_representation_with_actor(self):
        rid = str(uuid.uuid4())
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=rid,
        )
        s = str(log)
        self.assertIn(AuditAction.INCIDENT_CREATED, s)
        self.assertIn(self.user.email, s)

    def test_str_representation_system_actor(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=None,
            action=AuditAction.SLA_BREACHED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        self.assertIn("system", str(log))

    # ------------------------------------------------------------------
    # Immutability guards
    # ------------------------------------------------------------------

    def test_save_blocks_update_to_existing_record(self):
        """Calling save() on an already-persisted AuditLog must raise ValidationError."""
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        log.resource_type = "tampered"
        with self.assertRaises(ValidationError):
            log.save()

    def test_delete_blocked_through_application(self):
        """Calling delete() on an AuditLog instance must raise ValidationError."""
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        with self.assertRaises(ValidationError):
            log.delete()

    def test_record_persists_after_blocked_delete(self):
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        try:
            log.delete()
        except ValidationError:
            pass
        self.assertTrue(AuditLog.objects.filter(id=log.id).exists())

    # ------------------------------------------------------------------
    # Cascade delete
    # ------------------------------------------------------------------

    def test_cascade_delete_when_organization_deleted(self):
        """When an organization is deleted, its audit logs cascade-delete."""
        log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        log_id = log.id
        # Use queryset delete (bypasses our instance-level guard)
        from organizations.models import Organization

        Organization.objects.filter(id=self.org.id).delete()
        self.assertFalse(AuditLog.objects.filter(id=log_id).exists())

    # ------------------------------------------------------------------
    # All action types are valid choices
    # ------------------------------------------------------------------

    def test_all_action_choices_persist(self):
        for action_value, _ in AuditAction.choices:
            log = AuditLog.objects.create(
                organization=self.org,
                actor=self.user,
                action=action_value,
                resource_type="test",
                resource_id=str(uuid.uuid4()),
            )
            self.assertEqual(log.action, action_value)

    # ------------------------------------------------------------------
    # Default ordering (newest first)
    # ------------------------------------------------------------------

    def test_ordering_newest_first(self):
        for i in range(3):
            AuditLog.objects.create(
                organization=self.org,
                actor=self.user,
                action=AuditAction.INCIDENT_CREATED,
                resource_type="incident",
                resource_id=str(uuid.uuid4()),
            )
        logs = list(AuditLog.objects.filter(organization=self.org))
        for i in range(len(logs) - 1):
            self.assertGreaterEqual(logs[i].created_at, logs[i + 1].created_at)
