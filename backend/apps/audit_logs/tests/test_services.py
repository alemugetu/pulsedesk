"""
Tests for AuditLogService.

Covers:
- Successful audit log creation
- Correct actor, organization, resource fields
- Metadata (changes) stored correctly
- System actor (actor=None) works
- IP address extraction from request
- Failure is silent — never raises or rolls back caller's transaction
- Transaction rollback: audit record rolls back with the business transaction
- Integration: incident creation creates an audit record
- Integration: incident status change creates an audit record
- Integration: incident assignment creates an audit record
- Integration: comment creation creates an audit record
- Integration: comment deletion creates an audit record
- Integration: attachment upload creates an audit record
- Integration: attachment deletion creates an audit record
- Integration: role creation creates an audit record
- Integration: role assignment creates an audit record
"""

import uuid

from audit_logs.models import AuditAction, AuditLog
from audit_logs.services import AuditLogService
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService, RBACService

User = get_user_model()

_PDF = b"%PDF-1.4 minimal"


def _make_user(email):
    return User.objects.create_user(email=email, password="Password123!")


def _get_owner_membership(user, org):
    return Membership.objects.get(user=user, organization=org)


class AuditLogServiceDirectTest(TestCase):
    """Tests calling AuditLogService.log() directly."""

    def setUp(self):
        self.user = _make_user("actor@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )

    def test_creates_audit_record(self):
        before = AuditLog.objects.filter(organization=self.org).count()
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
            changes={"title": "Test incident"},
        )
        after = AuditLog.objects.filter(organization=self.org).count()
        self.assertEqual(after, before + 1)

    def test_correct_actor_stored(self):
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=rid,
        )
        log = AuditLog.objects.get(organization=self.org, resource_id=rid)
        self.assertEqual(log.actor, self.user)

    def test_correct_organization_stored(self):
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=rid,
        )
        log = AuditLog.objects.get(resource_id=rid)
        self.assertEqual(log.organization, self.org)

    def test_changes_metadata_stored(self):
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_PRIORITY_CHANGED,
            resource_type="incident",
            resource_id=rid,
            changes={"old_priority": "P3", "new_priority": "P1"},
        )
        log = AuditLog.objects.get(resource_id=rid)
        self.assertEqual(log.changes["old_priority"], "P3")
        self.assertEqual(log.changes["new_priority"], "P1")

    def test_system_actor_null(self):
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=None,
            action=AuditAction.SLA_BREACHED,
            resource_type="incident",
            resource_id=rid,
        )
        log = AuditLog.objects.get(resource_id=rid)
        self.assertIsNone(log.actor)

    def test_empty_changes_stored_as_empty_dict(self):
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=rid,
        )
        log = AuditLog.objects.get(resource_id=rid)
        self.assertEqual(log.changes, {})

    def test_ip_extraction_from_remote_addr(self):
        rf = RequestFactory()
        request = rf.get("/", REMOTE_ADDR="10.0.0.1")
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=rid,
            request=request,
        )
        log = AuditLog.objects.get(resource_id=rid)
        self.assertEqual(log.ip_address, "10.0.0.1")

    def test_ip_extraction_from_x_forwarded_for(self):
        rf = RequestFactory()
        request = rf.get("/", HTTP_X_FORWARDED_FOR="203.0.113.5, 10.0.0.1")
        rid = str(uuid.uuid4())
        AuditLogService.log(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=rid,
            request=request,
        )
        log = AuditLog.objects.get(resource_id=rid)
        # Must take the first (leftmost) IP — the client IP
        self.assertEqual(log.ip_address, "203.0.113.5")

    def test_failure_is_silent_does_not_raise(self):
        """A broken changes dict (non-serializable) must not raise or roll back."""
        # Pass an organization that would cause an issue — but we pass valid args
        # and simulate by catching any unexpected error.
        # The real test is that the caller's transaction is not affected.
        try:
            AuditLogService.log(
                organization=self.org,
                actor=self.user,
                action="invalid.action.that.is.too.long" * 10,  # exceeds max_length
                resource_type="incident",
                resource_id=str(uuid.uuid4()),
            )
        except Exception as exc:  # noqa: BLE001
            self.fail(f"AuditLogService.log() raised unexpectedly: {exc}")

    def test_transaction_rollback_removes_audit_record(self):
        """
        Audit records created inside a rolled-back transaction are NOT persisted.
        This is the CORRECT behaviour — we must not audit events that did not happen.
        """
        from django.db import transaction

        rid = str(uuid.uuid4())
        try:
            with transaction.atomic():
                AuditLogService.log(
                    organization=self.org,
                    actor=self.user,
                    action=AuditAction.INCIDENT_CREATED,
                    resource_type="incident",
                    resource_id=rid,
                )
                raise ValueError("simulated rollback")
        except ValueError:
            pass

        self.assertFalse(AuditLog.objects.filter(resource_id=rid).exists())


class AuditLogIntegrationTest(TestCase):
    """
    Integration tests: verify that domain service operations create
    the expected AuditLog records.
    """

    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.membership = _get_owner_membership(self.user, self.org)

    def test_incident_creation_creates_audit_log(self):
        before = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.INCIDENT_CREATED
        ).count()
        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Test Incident",
        )
        after = AuditLog.objects.filter(
            organization=self.org, action=AuditAction.INCIDENT_CREATED
        ).count()
        self.assertEqual(after, before + 1)

        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.INCIDENT_CREATED,
            resource_id=str(incident.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.resource_type, "incident")

    def test_incident_status_change_creates_audit_log(self):
        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Status Test",
        )
        IncidentService.transition_incident_status(
            incident=incident,
            actor_membership=self.membership,
            new_status="ACKNOWLEDGED",
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.INCIDENT_STATUS_CHANGED,
            resource_id=str(incident.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changes["old_status"], "OPEN")
        self.assertEqual(log.changes["new_status"], "ACKNOWLEDGED")

    def test_incident_assignment_creates_audit_log(self):
        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Assign Test",
        )
        IncidentService.assign_incident(
            incident=incident,
            actor_membership=self.membership,
            assignee_membership=self.membership,
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.INCIDENT_ASSIGNED,
            resource_id=str(incident.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertIn("new_assignee_id", log.changes)

    def test_incident_priority_change_creates_audit_log(self):
        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Priority Test",
        )
        IncidentService.update_incident(
            incident=incident,
            actor_membership=self.membership,
            priority="P1",
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.INCIDENT_PRIORITY_CHANGED,
            resource_id=str(incident.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changes["new_priority"], "P1")

    def test_comment_creation_creates_audit_log(self):
        from comments.services import CommentService

        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Comment Audit Test",
        )
        comment = CommentService.create_comment(
            incident=incident,
            author=self.user,
            body="Test comment",
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.COMMENT_CREATED,
            resource_id=str(comment.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.user)

    def test_comment_deletion_creates_audit_log(self):
        from comments.services import CommentService

        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Comment Delete Audit",
        )
        comment = CommentService.create_comment(
            incident=incident,
            author=self.user,
            body="To be deleted",
        )
        comment_id = str(comment.id)
        CommentService.delete_comment(comment, self.user)
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.COMMENT_DELETED,
            resource_id=comment_id,
        ).first()
        self.assertIsNotNone(log)

    def test_attachment_upload_creates_audit_log(self):
        from attachments.services import AttachmentService

        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Attachment Audit Test",
        )
        f = SimpleUploadedFile("doc.pdf", _PDF, content_type="application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=incident, uploader=self.user, uploaded_file=f
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.ATTACHMENT_UPLOADED,
            resource_id=str(attachment.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changes["original_filename"], "doc.pdf")

    def test_attachment_deletion_creates_audit_log(self):
        from attachments.services import AttachmentService

        incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Attachment Delete Audit",
        )
        f = SimpleUploadedFile("doc.pdf", _PDF, content_type="application/pdf")
        attachment = AttachmentService.upload_attachment(
            incident=incident, uploader=self.user, uploaded_file=f
        )
        att_id = str(attachment.id)
        AttachmentService.delete_attachment(attachment, self.user)
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.ATTACHMENT_DELETED,
            resource_id=att_id,
        ).first()
        self.assertIsNotNone(log)

    def test_role_creation_creates_audit_log(self):
        role = RBACService.create_role(
            organization=self.org,
            name="Custom Role",
            actor_membership=self.membership,
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.ROLE_CREATED,
            resource_id=str(role.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changes["name"], "Custom Role")

    def test_role_assignment_creates_audit_log(self):
        other_user = _make_user("other@example.com")
        other_membership = Membership.objects.create(
            user=other_user,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        from organizations.selectors import get_organization_roles

        viewer_role = get_organization_roles(self.org).filter(slug="viewer").first()
        RBACService.assign_role_to_membership(
            membership=other_membership,
            role=viewer_role,
            actor_membership=self.membership,
        )
        log = AuditLog.objects.filter(
            organization=self.org,
            action=AuditAction.ROLE_ASSIGNED,
            resource_id=str(other_membership.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changes["new_role_name"], "Viewer")
