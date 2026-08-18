from dashboard import services as dashboard_services_module
from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class DashboardServicesModuleTest(TestCase):
    """
    Phase 11 architectural guard: the dashboard is a READ-MODEL/API layer.

    Per requirements:
      * 'Use services.py only where orchestration or business-level composition is required.'
      * 'Do not put simple queryset operations into unnecessary service layers.'
      * 'Avoid duplication between selectors and services.'

    The dashboard intentionally does NOT expose a services layer — all reads go
    through dashboard.selectors, which aggregate authoritative data from the
    incident / SLA / escalation domain modules.

    If a future phase requires orchestration-level composition (e.g. combining
    reads with side-effect operations), that logic belongs here.
    """

    def test_services_module_imports_cleanly(self):
        self.assertIsNotNone(dashboard_services_module)

    def test_no_duplicated_selector_functions_in_services(self):
        selector_names = {
            "get_dashboard_summary",
            "get_priority_distribution",
            "get_sla_metrics",
            "get_escalation_metrics",
            "get_dashboard_incidents",
        }
        service_attrs = set(dir(dashboard_services_module))
        overlap = selector_names & service_attrs
        self.assertEqual(
            overlap,
            set(),
            msg=(
                f"Services module should not duplicate selector names "
                f"(found overlap: {overlap}). Read queries live in selectors.py; "
                "services.py is for orchestration only."
            ),
        )

    def test_views_call_selectors_directly(self):
        """Sanity-check: dashboard views import from selectors, not services."""
        from dashboard import views as dashboard_views_module

        source = dashboard_views_module.__file__
        with open(source, "r", encoding="utf-8") as fh:
            src = fh.read()
        self.assertIn("from .selectors import", src)
        self.assertNotIn("from .services import", src)
