"""
Phase 6 — Workflow Engine Tests

Validates:
- All valid lifecycle transitions succeed.
- All invalid transitions are rejected with the correct error code.
- resolved_at is set on RESOLVED and preserved on CLOSED.
- resolved_at is NOT accepted from the client (server-side only).
- RBAC: Viewer cannot resolve/close.
- ALLOWED_TRANSITIONS is the single authoritative source.
"""

from django.contrib.auth import get_user_model
from incidents.models import IncidentStatus
from incidents.services import ALLOWED_TRANSITIONS, IncidentService
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class WorkflowValidTransitionsTest(APITestCase):
    """Test that the full valid lifecycle can be traversed."""

    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@workflow.test", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Workflow Org"
        )
        self.incident = IncidentService.create_incident(
            self.org, self.owner, "DB is down"
        )
        self.client.force_authenticate(user=self.owner)
        self.url = f"/api/v1/organizations/{self.org.id}/incidents/{self.incident.id}/"

    def test_open_to_acknowledged(self):
        res = self.client.patch(
            self.url, {"status": IncidentStatus.ACKNOWLEDGED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], IncidentStatus.ACKNOWLEDGED)
        self.assertIsNone(res.data["resolved_at"])

    def test_full_lifecycle(self):
        transitions = [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        ]
        for new_status in transitions:
            res = self.client.patch(self.url, {"status": new_status}, format="json")
            self.assertEqual(
                res.status_code,
                status.HTTP_200_OK,
                msg=f"Transition to {new_status} failed: {res.data}",
            )
            self.assertEqual(res.data["status"], new_status)

    def test_resolved_at_set_on_resolved(self):
        for s in [IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS]:
            self.client.patch(self.url, {"status": s}, format="json")
        res = self.client.patch(
            self.url, {"status": IncidentStatus.RESOLVED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res.data["resolved_at"])

    def test_resolved_at_preserved_on_closed(self):
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            self.client.patch(self.url, {"status": s}, format="json")

        # Already RESOLVED from loop — patch again to CLOSED
        closed_res = self.client.patch(
            self.url, {"status": IncidentStatus.CLOSED}, format="json"
        )
        self.assertEqual(closed_res.status_code, status.HTTP_200_OK)
        # resolved_at must be preserved (not cleared when moving to CLOSED)
        self.assertIsNotNone(closed_res.data["resolved_at"])

    def test_client_cannot_supply_resolved_at(self):
        """resolved_at is read-only; client-supplied value is ignored."""
        for s in [IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS]:
            self.client.patch(self.url, {"status": s}, format="json")
        res = self.client.patch(
            self.url,
            {"status": IncidentStatus.RESOLVED, "resolved_at": "2000-01-01T00:00:00Z"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # resolved_at must be recent, NOT 2000-01-01
        self.assertIsNotNone(res.data["resolved_at"])
        self.assertNotIn("2000-01-01", res.data["resolved_at"])

    def test_same_status_is_idempotent(self):
        """Sending same status as current must succeed silently."""
        res = self.client.patch(
            self.url, {"status": IncidentStatus.OPEN}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], IncidentStatus.OPEN)


class WorkflowInvalidTransitionsTest(APITestCase):
    """Test that every invalid transition is rejected."""

    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner2@workflow.test", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Invalid Workflow Org"
        )
        self.client.force_authenticate(user=self.owner)

    def _make_incident(self):
        return IncidentService.create_incident(self.org, self.owner, "Test Incident")

    def _url(self, incident):
        return f"/api/v1/organizations/{self.org.id}/incidents/{incident.id}/"

    def test_open_to_resolved_rejected(self):
        inc = self._make_incident()
        res = self.client.patch(
            self._url(inc), {"status": IncidentStatus.RESOLVED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", res.data)

    def test_open_to_closed_rejected(self):
        inc = self._make_incident()
        res = self.client.patch(
            self._url(inc), {"status": IncidentStatus.CLOSED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_open_to_in_progress_rejected(self):
        inc = self._make_incident()
        res = self.client.patch(
            self._url(inc), {"status": IncidentStatus.IN_PROGRESS}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_closed_to_open_rejected(self):
        inc = self._make_incident()
        url = self._url(inc)
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        ]:
            self.client.patch(url, {"status": s}, format="json")
        res = self.client.patch(url, {"status": IncidentStatus.OPEN}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resolved_to_in_progress_rejected(self):
        inc = self._make_incident()
        url = self._url(inc)
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            self.client.patch(url, {"status": s}, format="json")
        res = self.client.patch(
            url, {"status": IncidentStatus.IN_PROGRESS}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_acknowledged_to_resolved_rejected(self):
        inc = self._make_incident()
        url = self._url(inc)
        self.client.patch(url, {"status": IncidentStatus.ACKNOWLEDGED}, format="json")
        res = self.client.patch(url, {"status": IncidentStatus.RESOLVED}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_status_value_rejected(self):
        inc = self._make_incident()
        res = self.client.patch(self._url(inc), {"status": "FLYING"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class WorkflowAllowedTransitionsSourceTest(APITestCase):
    """Verify ALLOWED_TRANSITIONS is the single authoritative source."""

    def test_all_statuses_have_entries(self):
        """Every IncidentStatus must appear as a key in ALLOWED_TRANSITIONS."""
        for s in IncidentStatus.values:
            self.assertIn(
                s,
                ALLOWED_TRANSITIONS,
                msg=f"Status {s} is missing from ALLOWED_TRANSITIONS.",
            )

    def test_closed_has_no_allowed_transitions(self):
        self.assertEqual(ALLOWED_TRANSITIONS[IncidentStatus.CLOSED], set())

    def test_valid_forward_transitions(self):
        expected = {
            IncidentStatus.OPEN: {IncidentStatus.ACKNOWLEDGED},
            IncidentStatus.ACKNOWLEDGED: {IncidentStatus.IN_PROGRESS},
            IncidentStatus.IN_PROGRESS: {IncidentStatus.RESOLVED},
            IncidentStatus.RESOLVED: {IncidentStatus.CLOSED},
        }
        for from_status, allowed in expected.items():
            self.assertEqual(
                ALLOWED_TRANSITIONS[from_status],
                allowed,
                msg=f"Unexpected transitions from {from_status}.",
            )


class WorkflowRBACTest(APITestCase):
    """Viewer cannot perform restricted transitions; Agent can create/update."""

    def _make_org_with_role(self, role_slug: str):
        owner = User.objects.create_user(
            email=f"owner-{role_slug}@rbac.test", password="Password123!"
        )
        org = OrganizationService.create_organization(
            user=owner, name=f"Org {role_slug}"
        )
        user = User.objects.create_user(
            email=f"user-{role_slug}@rbac.test", password="Password123!"
        )
        role = org.roles.get(slug=role_slug)
        Membership.objects.create(
            user=user, organization=org, role=role, status=MembershipStatus.ACTIVE
        )
        incident = IncidentService.create_incident(org, owner, "RBAC Test Incident")
        return org, owner, user, incident

    def test_viewer_cannot_resolve(self):
        org, owner, viewer, incident = self._make_org_with_role("viewer")
        # Advance to IN_PROGRESS as owner
        self.client.force_authenticate(user=owner)
        url = f"/api/v1/organizations/{org.id}/incidents/{incident.id}/"
        self.client.patch(url, {"status": IncidentStatus.ACKNOWLEDGED}, format="json")
        self.client.patch(url, {"status": IncidentStatus.IN_PROGRESS}, format="json")

        # Viewer tries to resolve
        self.client.force_authenticate(user=viewer)
        res = self.client.patch(url, {"status": IncidentStatus.RESOLVED}, format="json")
        self.assertIn(
            res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN]
        )

    def test_viewer_cannot_close(self):
        org, owner, viewer, incident = self._make_org_with_role("viewer")
        self.client.force_authenticate(user=owner)
        url = f"/api/v1/organizations/{org.id}/incidents/{incident.id}/"
        for s in [
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.RESOLVED,
        ]:
            self.client.patch(url, {"status": s}, format="json")

        self.client.force_authenticate(user=viewer)
        res = self.client.patch(url, {"status": IncidentStatus.CLOSED}, format="json")
        self.assertIn(
            res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN]
        )

    def test_agent_can_acknowledge(self):
        org, _, agent, incident = self._make_org_with_role("agent")
        self.client.force_authenticate(user=agent)
        url = f"/api/v1/organizations/{org.id}/incidents/{incident.id}/"
        res = self.client.patch(
            url, {"status": IncidentStatus.ACKNOWLEDGED}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
