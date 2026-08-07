
from django.contrib.auth import get_user_model
from django.test import TestCase
from organizations.permissions import IsOrganizationMember
from organizations.services import OrganizationService
from rest_framework.test import APIRequestFactory

User = get_user_model()


class IsOrganizationMemberPermissionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='member@example.com',
            password='testpass123',
        )
        self.organization = OrganizationService.create_organization(
            user=self.user,
            name='Acme Corp',
        )
        self.factory = APIRequestFactory()

    def test_permission_allows_active_member(self):
        request = self.factory.get(
            f'/api/v1/organizations/{self.organization.id}/',
        )
        request.user = self.user
        permission = IsOrganizationMember()
        view = type('View', (), {'kwargs': {'organization_id': self.organization.id}})()
        self.assertTrue(permission.has_permission(request, view))
        self.assertEqual(request.organization, self.organization)

    def test_permission_denies_unauthenticated_user(self):
        request = self.factory.get(
            f'/api/v1/organizations/{self.organization.id}/',
        )
        request.user = None
        permission = IsOrganizationMember()
        view = type('View', (), {'kwargs': {'organization_id': self.organization.id}})()
        self.assertFalse(permission.has_permission(request, view))
