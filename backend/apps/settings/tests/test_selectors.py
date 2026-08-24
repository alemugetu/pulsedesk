"""
Selector-layer tests for OrganizationSettings.

Covers:
- get_settings_for_organization: creates on demand, returns existing record
- get_settings_by_org_id: valid UUID returns settings, invalid/missing → None
- Selectors never expose cross-tenant data (each org's record is isolated)
"""

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.models import Organization
from settings.models import OrganizationSettings
from settings.selectors import (
    get_settings_by_org_id,
    get_settings_for_organization,
)

User = get_user_model()


def _make_org(name="Acme", slug=None):
    slug = slug or Organization.normalize_slug(name)
    return Organization.objects.create(name=name, slug=slug)


class GetSettingsForOrganizationSelectorTest(TestCase):
    def test_returns_existing_settings(self):
        org = _make_org()
        existing = OrganizationSettings.objects.create(
            organization=org, default_incident_priority="P1"
        )
        result = get_settings_for_organization(org)
        self.assertEqual(result.id, existing.id)
        self.assertEqual(result.default_incident_priority, "P1")

    def test_creates_settings_when_missing(self):
        org = _make_org()
        self.assertFalse(
            OrganizationSettings.objects.filter(organization=org).exists()
        )
        settings = get_settings_for_organization(org)
        self.assertIsNotNone(settings)
        self.assertEqual(settings.organization, org)
        self.assertEqual(settings.default_incident_priority, "P3")

    def test_is_tenant_isolated(self):
        org_a = _make_org("Acme A", "acme-a")
        org_b = _make_org("Acme B", "acme-b")
        OrganizationSettings.objects.create(
            organization=org_a, default_incident_priority="P1"
        )
        OrganizationSettings.objects.create(
            organization=org_b, default_incident_priority="P4"
        )

        a_settings = get_settings_for_organization(org_a)
        b_settings = get_settings_for_organization(org_b)

        self.assertNotEqual(a_settings.id, b_settings.id)
        self.assertEqual(a_settings.default_incident_priority, "P1")
        self.assertEqual(b_settings.default_incident_priority, "P4")
        # Each selector call is scoped — no cross-tenant leakage.
        self.assertEqual(a_settings.organization_id, org_a.id)
        self.assertEqual(b_settings.organization_id, org_b.id)


class GetSettingsByOrgIdSelectorTest(TestCase):
    def test_valid_uuid_returns_settings(self):
        org = _make_org()
        OrganizationSettings.objects.create(organization=org)
        settings = get_settings_by_org_id(org.id)
        self.assertIsNotNone(settings)
        self.assertEqual(settings.organization_id, org.id)

    def test_valid_uuid_backfills_when_missing(self):
        org = _make_org()
        self.assertFalse(
            OrganizationSettings.objects.filter(organization=org).exists()
        )
        settings = get_settings_by_org_id(org.id)
        self.assertIsNotNone(settings)

    def test_nonexistent_uuid_returns_none(self):
        result = get_settings_by_org_id(uuid.uuid4())
        self.assertIsNone(result)

    def test_invalid_uuid_string_returns_none(self):
        result = get_settings_by_org_id("not-a-real-uuid")
        self.assertIsNone(result)

    def test_wrong_type_returns_none(self):
        self.assertIsNone(get_settings_by_org_id(None))
        self.assertIsNone(get_settings_by_org_id(12345))
