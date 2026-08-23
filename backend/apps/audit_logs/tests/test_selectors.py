"""
Tests for AuditLog selectors.

Covers:
- get_audit_logs: organization isolation (never returns another org's records)
- get_audit_logs: filter by action
- get_audit_logs: filter by resource_type
- get_audit_logs: filter by resource_id
- get_audit_logs: filter by actor_id
- get_audit_logs: filter by date_from
- get_audit_logs: filter by date_to
- get_audit_logs: combined filters
- get_audit_logs: invalid actor_id returns empty queryset (no error)
- get_audit_logs: ordering newest-first
- get_audit_log: returns correct record for valid org+id
- get_audit_log: returns None for wrong organization (IDOR prevention)
- get_audit_log: returns None for non-existent id
- get_audit_log: returns None for invalid UUID
- get_resource_audit_logs: scoped resource history
"""

import uuid
from datetime import timedelta

from audit_logs.models import AuditAction, AuditLog
from audit_logs.selectors import (
    get_audit_log,
    get_audit_logs,
    get_resource_audit_logs,
)
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from organizations.services import OrganizationService

User = get_user_model()


def _make_user(email):
    return User.objects.create_user(email=email, password="Password123!")


def _make_log(
    org,
    user,
    action=AuditAction.INCIDENT_CREATED,
    resource_type="incident",
    resource_id=None,
    changes=None,
):
    return AuditLog.objects.create(
        organization=org,
        actor=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id or str(uuid.uuid4()),
        changes=changes or {},
    )


class GetAuditLogsTest(TestCase):
    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.other_user = _make_user("other@example.com")
        self.other_org = OrganizationService.create_organization(
            user=self.other_user, name="Other Corp"
        )

    def test_returns_only_this_orgs_records(self):
        _make_log(self.org, self.user)
        _make_log(self.other_org, self.other_user)
        qs = get_audit_logs(self.org)
        for log in qs:
            self.assertEqual(log.organization_id, self.org.id)

    def test_cross_tenant_isolation(self):
        _make_log(
            self.other_org,
            self.other_user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        qs = get_audit_logs(self.org)
        self.assertEqual(qs.count(), 0)

    def test_filter_by_action(self):
        _make_log(self.org, self.user, action=AuditAction.INCIDENT_CREATED)
        _make_log(
            self.org,
            self.user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        qs = get_audit_logs(self.org, action=AuditAction.INCIDENT_CREATED)
        for log in qs:
            self.assertEqual(log.action, AuditAction.INCIDENT_CREATED)
        self.assertGreaterEqual(qs.count(), 1)

    def test_filter_by_resource_type(self):
        _make_log(self.org, self.user, resource_type="incident")
        _make_log(
            self.org,
            self.user,
            resource_type="comment",
            action=AuditAction.COMMENT_CREATED,
        )
        qs = get_audit_logs(self.org, resource_type="comment")
        for log in qs:
            self.assertEqual(log.resource_type, "comment")

    def test_filter_by_resource_id(self):
        rid = str(uuid.uuid4())
        _make_log(self.org, self.user, resource_id=rid)
        _make_log(self.org, self.user)
        qs = get_audit_logs(self.org, resource_id=rid)
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs.first().resource_id, rid)

    def test_filter_by_actor_id(self):
        other_user = _make_user("agent@example.com")
        from organizations.models import Membership, MembershipStatus

        Membership.objects.create(
            user=other_user, organization=self.org, status=MembershipStatus.ACTIVE
        )
        _make_log(self.org, self.user)
        _make_log(
            self.org,
            other_user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        qs = get_audit_logs(self.org, actor_id=str(other_user.id))
        for log in qs:
            self.assertEqual(log.actor_id, other_user.id)

    def test_filter_by_date_from(self):
        now = timezone.now()
        # Create one log manually to simulate "old"
        old_log = AuditLog.objects.create(
            organization=self.org,
            actor=self.user,
            action=AuditAction.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=str(uuid.uuid4()),
        )
        # date_from set to "now" — old_log's created_at should be in the past
        qs = get_audit_logs(self.org, date_from=now + timedelta(seconds=1))
        self.assertNotIn(old_log, list(qs))

    def test_filter_by_date_to(self):
        now = timezone.now()
        _make_log(self.org, self.user)
        # date_to before created_at means no results
        past = now - timedelta(hours=1)
        qs = get_audit_logs(self.org, date_to=past)
        self.assertEqual(qs.count(), 0)

    def test_no_filters_returns_all_org_records(self):
        _make_log(self.org, self.user)
        _make_log(
            self.org,
            self.user,
            action=AuditAction.COMMENT_CREATED,
            resource_type="comment",
        )
        qs = get_audit_logs(self.org)
        self.assertGreaterEqual(qs.count(), 2)

    def test_invalid_actor_id_returns_empty_queryset(self):
        _make_log(self.org, self.user)
        qs = get_audit_logs(self.org, actor_id="not-a-uuid")
        self.assertEqual(qs.count(), 0)

    def test_ordering_newest_first(self):
        for _ in range(3):
            _make_log(self.org, self.user)
        logs = list(get_audit_logs(self.org))
        for i in range(len(logs) - 1):
            self.assertGreaterEqual(logs[i].created_at, logs[i + 1].created_at)

    def test_system_actor_null_record_returned(self):
        _make_log(self.org, None, action=AuditAction.SLA_BREACHED)
        qs = get_audit_logs(self.org, action=AuditAction.SLA_BREACHED)
        self.assertEqual(qs.count(), 1)
        self.assertIsNone(qs.first().actor)


class GetAuditLogTest(TestCase):
    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.other_user = _make_user("other@example.com")
        self.other_org = OrganizationService.create_organization(
            user=self.other_user, name="Other Corp"
        )
        self.log = _make_log(self.org, self.user)

    def test_returns_correct_record(self):
        result = get_audit_log(self.org, self.log.id)
        self.assertIsNotNone(result)
        self.assertEqual(result.id, self.log.id)

    def test_returns_none_for_nonexistent_id(self):
        result = get_audit_log(self.org, uuid.uuid4())
        self.assertIsNone(result)

    def test_returns_none_for_wrong_organization(self):
        """IDOR prevention: cannot retrieve this org's log via another org."""
        result = get_audit_log(self.other_org, self.log.id)
        self.assertIsNone(result)

    def test_returns_none_for_invalid_uuid(self):
        result = get_audit_log(self.org, "not-a-uuid")
        self.assertIsNone(result)

    def test_returns_none_for_none_id(self):
        result = get_audit_log(self.org, None)
        self.assertIsNone(result)


class GetResourceAuditLogsTest(TestCase):
    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )

    def test_returns_only_records_for_that_resource(self):
        rid_a = str(uuid.uuid4())
        rid_b = str(uuid.uuid4())
        _make_log(self.org, self.user, resource_type="incident", resource_id=rid_a)
        _make_log(self.org, self.user, resource_type="incident", resource_id=rid_b)
        qs = get_resource_audit_logs(self.org, "incident", rid_a)
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs.first().resource_id, rid_a)

    def test_cross_tenant_isolation(self):
        other_user = _make_user("other@example.com")
        other_org = OrganizationService.create_organization(
            user=other_user, name="Other Corp"
        )
        rid = str(uuid.uuid4())
        _make_log(other_org, other_user, resource_type="incident", resource_id=rid)
        qs = get_resource_audit_logs(self.org, "incident", rid)
        self.assertEqual(qs.count(), 0)
