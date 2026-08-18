from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from organizations.services import OrganizationService
from incidents.services import IncidentService

User = get_user_model()

class DashboardPerformanceTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@perf.test", password="Password123!")
        self.org = OrganizationService.create_organization(user=self.owner, name="Perf Org")
        self.client.force_authenticate(user=self.owner)
        self.incidents_url = f"/api/v1/organizations/{self.org.id}/dashboard/incidents/"
        self.summary_url = f"/api/v1/organizations/{self.org.id}/dashboard/summary/"

    def test_incident_list_no_n_plus_one(self):
        IncidentService.create_incident(self.org, self.owner, "Inc 1")

        with CaptureQueriesContext(connection) as ctx_one:
            res_one = self.client.get(self.incidents_url)
        queries_one = len(ctx_one.captured_queries)

        for i in range(10):
            IncidentService.create_incident(self.org, self.owner, f"Inc {i+2}")

        with CaptureQueriesContext(connection) as ctx_many:
            res_many = self.client.get(self.incidents_url)
        queries_many = len(ctx_many.captured_queries)

        self.assertEqual(res_one.status_code, 200)
        self.assertEqual(res_many.status_code, 200)
        self.assertLessEqual(
            queries_many,
            queries_one + 2,
            msg=(
                f"Query count grew suspiciously from {queries_one} to {queries_many} "
                "when adding 10 incidents — possible N+1 issue."
            ),
        )

    def test_summary_constant_queries(self):
        IncidentService.create_incident(self.org, self.owner, "Inc 1")

        with CaptureQueriesContext(connection) as ctx_one:
            res_one = self.client.get(self.summary_url)
        queries_one = len(ctx_one.captured_queries)

        for i in range(20):
            IncidentService.create_incident(self.org, self.owner, f"Inc {i+2}")

        with CaptureQueriesContext(connection) as ctx_many:
            res_many = self.client.get(self.summary_url)
        queries_many = len(ctx_many.captured_queries)

        self.assertEqual(res_one.status_code, 200)
        self.assertEqual(res_many.status_code, 200)
        self.assertLessEqual(
            queries_many,
            queries_one + 1,
            msg=(
                f"Summary query count grew from {queries_one} to {queries_many} "
                "— counts should use database aggregation, not scale with incident count."
            ),
        )
