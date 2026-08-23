"""
Phase 13.4 — Incident Search, Filtering, Sorting & Pagination tests.

Covers:
  - Text search (title, description, incident_number)
  - Status / priority / assignee / category / date-range / SLA-state filters
  - Filter composition (AND semantics)
  - Safe allowlisted ordering
  - Pagination with filters
  - Tenant isolation (cross-tenant IDOR prevention)
  - RBAC enforcement
  - Query-count (N+1 guard)
"""

import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from incidents.services import CategoryService, IncidentService
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APITestCase
from sla.models import IncidentSLA, SLAPolicy, SLATarget

User = get_user_model()


class _FilterTestBase(APITestCase):
    """Shared setUp for filter tests — one org, one owner, several incidents."""

    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.owner, name="Acme Corp"
        )
        # Owner gets an active membership with the system "viewer" role so
        # that incident.view permission is granted.
        viewer_role = Role.objects.get(
            organization=self.org, slug="viewer", is_system_role=True
        )
        owner_membership = Membership.objects.get(
            user=self.owner, organization=self.org
        )
        owner_membership.role = viewer_role
        owner_membership.save()

        # Categories
        self.cat_infra = CategoryService.create_category(self.org, "Infrastructure")
        self.cat_security = CategoryService.create_category(self.org, "Security")

        # Incidents with varied attributes
        self.inc_open_p1 = IncidentService.create_incident(
            self.org,
            self.owner,
            "Database server down",
            description="Primary DB is unreachable",
            priority="P1",
            category_id=str(self.cat_infra.id),
        )
        self.inc_open_p3 = IncidentService.create_incident(
            self.org,
            self.owner,
            "Slow login page",
            description="Users report slow login",
            priority="P3",
            category_id=str(self.cat_infra.id),
        )
        self.inc_p2_security = IncidentService.create_incident(
            self.org,
            self.owner,
            "Suspicious login attempt",
            description="Brute force detected from 10.0.0.1",
            priority="P2",
            category_id=str(self.cat_security.id),
        )

        self.client.force_authenticate(user=self.owner)
        self.url = f"/api/v1/organizations/{self.org.id}/incidents/"

    # -- helpers --
    def _get(self, query=""):
        return self.client.get(f"{self.url}{query}")

    def _result_titles(self, response):
        return [r["title"] for r in response.data["results"]]


# =========================================================================
# 1. Text search
# =========================================================================


class IncidentSearchTest(_FilterTestBase):
    def test_search_by_title(self):
        resp = self._get("?search=database")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["title"], "Database server down")

    def test_search_by_description(self):
        resp = self._get("?search=brute+force")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(
            resp.data["results"][0]["title"], "Suspicious login attempt"
        )

    def test_search_by_incident_number(self):
        resp = self._get("?search=INC-000001")
        self.assertEqual(resp.data["count"], 1)

    def test_search_case_insensitive(self):
        resp = self._get("?search=DATABASE")
        self.assertEqual(resp.data["count"], 1)

    def test_search_partial_match(self):
        resp = self._get("?search=login")
        # "Slow login page" + "Suspicious login attempt"
        self.assertEqual(resp.data["count"], 2)

    def test_search_no_results(self):
        resp = self._get("?search=nonexistent-xyz")
        self.assertEqual(resp.data["count"], 0)
        self.assertEqual(resp.data["results"], [])


# =========================================================================
# 2. Status filter
# =========================================================================


class IncidentStatusFilterTest(_FilterTestBase):
    def test_filter_open(self):
        resp = self._get("?status=OPEN")
        self.assertEqual(resp.data["count"], 3)

    def test_filter_closed_returns_empty(self):
        resp = self._get("?status=CLOSED")
        self.assertEqual(resp.data["count"], 0)

    def test_invalid_status_returns_empty(self):
        """Invalid status is passed to ORM — returns 0 (no Python-side error)."""
        resp = self._get("?status=BOGUS")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 0)


# =========================================================================
# 3. Priority filter
# =========================================================================


class IncidentPriorityFilterTest(_FilterTestBase):
    def test_filter_p1(self):
        resp = self._get("?priority=P1")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["priority"], "P1")

    def test_filter_p2(self):
        resp = self._get("?priority=P2")
        self.assertEqual(resp.data["count"], 1)

    def test_filter_p3(self):
        resp = self._get("?priority=P3")
        self.assertEqual(resp.data["count"], 1)

    def test_invalid_priority(self):
        resp = self._get("?priority=P99")
        self.assertEqual(resp.data["count"], 0)


# =========================================================================
# 4. Assignee filter
# =========================================================================


class IncidentAssigneeFilterTest(_FilterTestBase):
    def setUp(self):
        super().setUp()
        # Upgrade owner's role to one that has incident.assign permission.
        admin_role = Role.objects.get(
            organization=self.org, slug="organization-admin", is_system_role=True
        )
        owner_membership = Membership.objects.get(
            user=self.owner, organization=self.org
        )
        owner_membership.role = admin_role
        owner_membership.save()

        # Create a second member and assign them to one incident.
        self.agent = User.objects.create_user(
            email="agent@example.com", password="Password123!"
        )
        agent_role = Role.objects.get(
            organization=self.org, slug="agent", is_system_role=True
        )
        self.agent_membership = Membership.objects.create(
            user=self.agent,
            organization=self.org,
            role=agent_role,
            status=MembershipStatus.ACTIVE,
        )
        # Assign agent to inc_open_p1
        IncidentService.assign_incident(
            self.inc_open_p1,
            actor_membership=owner_membership,
            assignee_membership=self.agent_membership,
        )

    def test_filter_by_assignee(self):
        resp = self._get(f"?assignee={self.agent_membership.id}")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["title"], "Database server down")

    def test_unassigned_incidents_not_returned(self):
        """Filtering for the agent should NOT return unassigned incidents."""
        resp = self._get(f"?assignee={self.agent_membership.id}")
        titles = self._result_titles(resp)
        self.assertNotIn("Slow login page", titles)

    def test_cross_tenant_assignee_returns_empty(self):
        """Assignee UUID from another org → empty, no information leak."""
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(other_user, "Other Org")
        other_membership = Membership.objects.get(
            user=other_user, organization=other_org
        )
        resp = self._get(f"?assignee={other_membership.id}")
        self.assertEqual(resp.data["count"], 0)

    def test_invalid_uuid_assignee(self):
        resp = self._get("?assignee=not-a-uuid")
        self.assertEqual(resp.data["count"], 0)


# =========================================================================
# 5. Category filter
# =========================================================================


class IncidentCategoryFilterTest(_FilterTestBase):
    def test_filter_by_category(self):
        resp = self._get(f"?category={self.cat_security.id}")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(
            resp.data["results"][0]["title"], "Suspicious login attempt"
        )

    def test_filter_infra_category(self):
        resp = self._get(f"?category={self.cat_infra.id}")
        self.assertEqual(resp.data["count"], 2)

    def test_cross_tenant_category_returns_empty(self):
        other_user = User.objects.create_user(
            email="xtenant@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(other_user, "Other")
        other_cat = CategoryService.create_category(other_org, "Other Cat")
        resp = self._get(f"?category={other_cat.id}")
        self.assertEqual(resp.data["count"], 0)

    def test_invalid_uuid_category(self):
        resp = self._get("?category=garbage")
        self.assertEqual(resp.data["count"], 0)


# =========================================================================
# 6. Date-range filter
# =========================================================================


class IncidentDateRangeFilterTest(_FilterTestBase):
    def test_created_after(self):
        # All incidents were created just now, so after=yesterday → all 3
        yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        resp = self._get(f"?created_after={yesterday}")
        self.assertEqual(resp.data["count"], 3)

    def test_created_before_future(self):
        tomorrow = (timezone.now() + timedelta(days=1)).isoformat()
        resp = self._get(f"?created_before={tomorrow}")
        self.assertEqual(resp.data["count"], 3)

    def test_created_after_future_returns_empty(self):
        future = (timezone.now() + timedelta(days=30)).isoformat()
        resp = self._get(f"?created_after={future}")
        self.assertEqual(resp.data["count"], 0)

    def test_date_range_both(self):
        yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        tomorrow = (timezone.now() + timedelta(days=1)).isoformat()
        resp = self._get(f"?created_after={yesterday}&created_before={tomorrow}")
        self.assertEqual(resp.data["count"], 3)

    def test_timezone_aware_datetime(self):
        """ISO-8601 with Z suffix should work."""
        now_str = timezone.now().isoformat()
        resp = self._get(f"?created_after={now_str}")
        # Might be 0 or more depending on exact timing; just check no error.
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# =========================================================================
# 7. SLA-state filter
# =========================================================================


class IncidentSLAStateFilterTest(_FilterTestBase):
    def setUp(self):
        super().setUp()
        # Create an SLA policy so incidents get SLA records.
        self.sla_policy = SLAPolicy.objects.create(
            organization=self.org,
            name="Default SLA",
            is_active=True,
            is_default=True,
        )
        SLATarget.objects.create(
            policy=self.sla_policy,
            priority="P1",
            response_time_minutes=30,
            resolution_time_minutes=240,
        )
        SLATarget.objects.create(
            policy=self.sla_policy,
            priority="P2",
            response_time_minutes=60,
            resolution_time_minutes=480,
        )
        SLATarget.objects.create(
            policy=self.sla_policy,
            priority="P3",
            response_time_minutes=120,
            resolution_time_minutes=960,
        )

        # Re-create incidents so they pick up the SLA policy.
        # (The incidents created in super().setUp() may not have SLA records
        # because no policy existed at that time.)
        self.inc_sla_breached = IncidentService.create_incident(
            self.org, self.owner, "Breached incident", priority="P1"
        )
        self.inc_sla_on_track = IncidentService.create_incident(
            self.org, self.owner, "On-track incident", priority="P3"
        )
        self.inc_sla_completed = IncidentService.create_incident(
            self.org, self.owner, "Completed incident", priority="P2"
        )

        # Manipulate SLA records to create distinct states.
        now = timezone.now()
        # BREACHED
        IncidentSLA.objects.filter(incident=self.inc_sla_breached).update(
            response_breached=True,
            response_deadline=now - timedelta(hours=1),
        )
        # ON_TRACK — deadline in the future, not breached, not completed
        IncidentSLA.objects.filter(incident=self.inc_sla_on_track).update(
            response_breached=False,
            resolution_breached=False,
            response_deadline=now + timedelta(hours=10),
            resolution_deadline=now + timedelta(hours=20),
            response_completed_at=None,
            resolution_completed_at=None,
        )
        # COMPLETED — both completed
        IncidentSLA.objects.filter(incident=self.inc_sla_completed).update(
            response_breached=False,
            resolution_breached=False,
            response_completed_at=now - timedelta(hours=1),
            resolution_completed_at=now - timedelta(minutes=30),
        )

    def test_filter_breached(self):
        resp = self._get("?sla_state=BREACHED")
        titles = self._result_titles(resp)
        self.assertIn("Breached incident", titles)
        self.assertNotIn("On-track incident", titles)
        self.assertNotIn("Completed incident", titles)

    def test_filter_on_track(self):
        resp = self._get("?sla_state=ON_TRACK")
        titles = self._result_titles(resp)
        self.assertIn("On-track incident", titles)
        self.assertNotIn("Breached incident", titles)
        self.assertNotIn("Completed incident", titles)

    def test_filter_completed(self):
        resp = self._get("?sla_state=COMPLETED")
        titles = self._result_titles(resp)
        self.assertIn("Completed incident", titles)
        self.assertNotIn("Breached incident", titles)
        self.assertNotIn("On-track incident", titles)

    def test_invalid_sla_state_returns_empty(self):
        resp = self._get("?sla_state=BOGUS")
        self.assertEqual(resp.data["count"], 0)


# =========================================================================
# 8. Team filter (no Team model)
# =========================================================================


class IncidentTeamFilterTest(_FilterTestBase):
    def test_team_filter_returns_empty(self):
        """No Team model exists — team filter always returns empty."""
        resp = self._get(f"?team={uuid.uuid4()}")
        self.assertEqual(resp.data["count"], 0)


# =========================================================================
# 9. Filter combinations (AND semantics)
# =========================================================================


class IncidentCombinationFilterTest(_FilterTestBase):
    def test_status_and_priority(self):
        resp = self._get("?status=OPEN&priority=P1")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["title"], "Database server down")

    def test_search_and_status(self):
        resp = self._get("?search=login&status=OPEN")
        # "Slow login page" (P3) + "Suspicious login attempt" (P2) — both OPEN
        self.assertEqual(resp.data["count"], 2)

    def test_priority_and_category(self):
        resp = self._get(f"?priority=P1&category={self.cat_infra.id}")
        self.assertEqual(resp.data["count"], 1)

    def test_search_and_date_range(self):
        yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        resp = self._get(f"?search=database&created_after={yesterday}")
        self.assertEqual(resp.data["count"], 1)

    def test_all_filters_combined(self):
        """Stack every filter — should still return the correct result."""
        yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        query = (
            f"?search=database"
            f"&status=OPEN"
            f"&priority=P1"
            f"&category={self.cat_infra.id}"
            f"&created_after={yesterday}"
        )
        resp = self._get(query)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["title"], "Database server down")


# =========================================================================
# 10. Ordering
# =========================================================================


class IncidentOrderingTest(_FilterTestBase):
    def test_default_ordering_is_created_at_desc(self):
        resp = self._get("")
        titles = self._result_titles(resp)
        # Most recently created first
        self.assertEqual(titles[0], "Suspicious login attempt")

    def test_order_by_priority_asc(self):
        resp = self._get("?ordering=priority")
        priorities = [r["priority"] for r in resp.data["results"]]
        self.assertEqual(priorities, sorted(priorities))

    def test_order_by_priority_desc(self):
        resp = self._get("?ordering=-priority")
        priorities = [r["priority"] for r in resp.data["results"]]
        self.assertEqual(priorities, sorted(priorities, reverse=True))

    def test_order_by_status(self):
        resp = self._get("?ordering=status")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_order_by_incident_number(self):
        resp = self._get("?ordering=incident_number")
        numbers = [r["incident_number"] for r in resp.data["results"]]
        self.assertEqual(numbers, sorted(numbers))

    def test_invalid_ordering_ignored(self):
        """Invalid ordering field is silently ignored; default order applies."""
        resp = self._get("?ordering=bogus_field")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Default ordering (-created_at) should apply
        titles = self._result_titles(resp)
        self.assertEqual(titles[0], "Suspicious login attempt")

    def test_multiple_ordering_fields(self):
        resp = self._get("?ordering=priority,-created_at")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 3)

    def test_ordering_does_not_expose_cross_tenant(self):
        """Ordering is safe — it only affects the org-scoped queryset."""
        resp = self._get("?ordering=-created_at")
        self.assertEqual(resp.data["count"], 3)


# =========================================================================
# 11. Pagination
# =========================================================================


class IncidentPaginationFilterTest(_FilterTestBase):
    def test_first_page(self):
        resp = self._get("?page=1")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("count", resp.data)
        self.assertIn("results", resp.data)

    def test_page_beyond_results(self):
        resp = self._get("?page=999")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_filtered_pagination(self):
        resp = self._get("?priority=P1&page=1")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_deterministic_ordering_across_pages(self):
        """Results on page 1 + page 2 should equal all results (no dupes)."""
        # Create enough incidents to span pages (PAGE_SIZE=50).
        for i in range(51):
            IncidentService.create_incident(
                self.org, self.owner, f"Bulk incident {i}"
            )
        r1 = self._get("?page=1&ordering=created_at")
        r2 = self._get("?page=2&ordering=created_at")
        all_titles = self._result_titles(r1) + self._result_titles(r2)
        self.assertEqual(len(all_titles), len(set(all_titles)))


# =========================================================================
# 12. Security — tenant isolation
# =========================================================================


class IncidentFilterSecurityTest(_FilterTestBase):
    def setUp(self):
        super().setUp()
        # Create a second organization with its own incidents.
        self.user_b = User.objects.create_user(
            email="userb@example.com", password="Password123!"
        )
        self.org_b = OrganizationService.create_organization(
            self.user_b, "Org B"
        )
        self.incident_b = IncidentService.create_incident(
            self.org_b, self.user_b, "Org B secret incident"
        )

    def test_org_a_cannot_see_org_b_incidents(self):
        """User A (owner) can only see their own org's incidents."""
        resp = self._get("")
        titles = self._result_titles(resp)
        self.assertNotIn("Org B secret incident", titles)
        self.assertEqual(resp.data["count"], 3)

    def test_org_a_search_cannot_leak_org_b(self):
        resp = self._get("?search=secret")
        self.assertEqual(resp.data["count"], 0)

    def test_cross_tenant_assignee_filter(self):
        membership_b = Membership.objects.get(
            user=self.user_b, organization=self.org_b
        )
        resp = self._get(f"?assignee={membership_b.id}")
        self.assertEqual(resp.data["count"], 0)

    def test_cross_tenant_category_filter(self):
        cat_b = CategoryService.create_category(self.org_b, "Org B Cat")
        resp = self._get(f"?category={cat_b.id}")
        self.assertEqual(resp.data["count"], 0)

    def test_unauthenticated_cannot_search(self):
        self.client.force_authenticate(user=None)
        resp = self._get("?search=database")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# =========================================================================
# 13. RBAC enforcement
# =========================================================================


class IncidentFilterRBACTest(_FilterTestBase):
    def setUp(self):
        super().setUp()
        # Create a member with no role (should lack incident.view).
        self.no_role_user = User.objects.create_user(
            email="norole@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=self.no_role_user,
            organization=self.org,
            role=None,
            status=MembershipStatus.ACTIVE,
        )

    def test_user_without_view_permission_gets_403(self):
        self.client.force_authenticate(user=self.no_role_user)
        resp = self._get("?search=database")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# =========================================================================
# 14. Performance — query count
# =========================================================================


class IncidentFilterPerformanceTest(_FilterTestBase):
    def test_list_does_not_n_plus_one(self):
        """The list endpoint should use a bounded number of queries."""
        # Create 10 extra incidents with categories.
        for i in range(10):
            IncidentService.create_incident(
                self.org,
                self.owner,
                f"Perf incident {i}",
                category_id=str(self.cat_infra.id),
            )
        # Bounded query count — not N+1 regardless of incident count.
        # Permission checks + org lookup + pagination count + data fetch.
        with self.assertNumQueries(6):
            resp = self._get("")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 13)  # 3 original + 10 extra
