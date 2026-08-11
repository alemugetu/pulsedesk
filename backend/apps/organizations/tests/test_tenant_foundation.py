from common.tenant import TenantScopedModel
from django.test import TestCase
from organizations.models import Organization


class TenantFoundationTest(TestCase):
    def test_tenant_scoped_model_is_abstract(self):
        self.assertTrue(TenantScopedModel._meta.abstract)

    def test_tenant_scoped_model_has_organization_field(self):
        field = TenantScopedModel._meta.get_field("organization")
        self.assertEqual(field.related_model, Organization)

    def test_tenant_scoped_manager_requires_organization(self):
        with self.assertRaises(ValueError):
            TenantScopedModel.objects.for_organization(None)
