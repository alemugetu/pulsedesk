"""Integration tests for RBAC API endpoints."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from organizations.models import Membership, MembershipStatus, Role
from organizations.services import OrganizationService
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class RBACViewBaseTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner_user = User.objects.create_user(
            email="owner@example.com", password="pass123"
        )
        self.owner_user.email_verified_at = timezone.now()
        self.owner_user.save()
        self.org = OrganizationService.create_organization(
            user=self.owner_user, name="Acme"
        )
        self.owner_membership = Membership.objects.get(
            user=self.owner_user, organization=self.org
        )

        # Additional users
        self.viewer_user = User.objects.create_user(
            email="viewer@example.com", password="pass123"
        )
        self.viewer_user.email_verified_at = timezone.now()
        self.viewer_user.save()
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        self.viewer_membership = Membership.objects.create(
            user=self.viewer_user,
            organization=self.org,
            role=viewer_role,
            status=MembershipStatus.ACTIVE,
        )

    def _auth_as(self, user):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "pass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")


class RoleListCreateViewTest(RBACViewBaseTest):
    def _url(self):
        return f"/api/v1/organizations/{self.org.id}/roles/"

    def test_owner_can_list_roles(self):
        self._auth_as(self.owner_user)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)  # 5 system roles

    def test_viewer_can_list_roles(self):
        self._auth_as(self.viewer_user)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_owner_can_create_custom_role(self):
        self._auth_as(self.owner_user)
        response = self.client.post(
            self._url(),
            {"name": "Support Agent", "permissions": ["member.view"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Support Agent")
        self.assertIn("member.view", response.data["permissions"])
        self.assertFalse(response.data["is_system_role"])

    def test_viewer_cannot_create_role(self):
        self._auth_as(self.viewer_user)
        response = self.client.post(
            self._url(),
            {"name": "Hacker Role"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_cannot_list_roles(self):
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_tenant_member_gets_404(self):
        outsider = User.objects.create_user(email="out@example.com", password="pass123")
        outsider.email_verified_at = timezone.now()
        outsider.save()
        OrganizationService.create_organization(user=outsider, name="Other")
        self._auth_as(outsider)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_role_response_contains_expected_fields(self):
        self._auth_as(self.owner_user)
        response = self.client.get(self._url())
        role_data = response.data[0]
        for field in (
            "id",
            "name",
            "slug",
            "description",
            "is_system_role",
            "permissions",
        ):
            self.assertIn(field, role_data)


class RoleDetailViewTest(RBACViewBaseTest):
    def setUp(self):
        super().setUp()
        self._auth_as(self.owner_user)
        create_resp = self.client.post(
            f"/api/v1/organizations/{self.org.id}/roles/",
            {"name": "Custom Role"},
            format="json",
        )
        self.custom_role_id = create_resp.data["id"]

    def _url(self, role_id=None):
        rid = role_id or self.custom_role_id
        return f"/api/v1/organizations/{self.org.id}/roles/{rid}/"

    def test_owner_can_retrieve_role(self):
        self._auth_as(self.owner_user)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_owner_can_update_custom_role(self):
        self._auth_as(self.owner_user)
        response = self.client.patch(
            self._url(), {"name": "Renamed Role"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Renamed Role")

    def test_cannot_update_system_role(self):
        system_role = Role.objects.get(organization=self.org, slug="viewer")
        self._auth_as(self.owner_user)
        response = self.client.patch(
            self._url(system_role.id),
            {"name": "Renamed Viewer"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_can_delete_custom_role(self):
        self._auth_as(self.owner_user)
        response = self.client.delete(self._url())
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_delete_system_role(self):
        system_role = Role.objects.get(organization=self.org, slug="viewer")
        self._auth_as(self.owner_user)
        response = self.client.delete(self._url(system_role.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_viewer_cannot_update_role(self):
        self._auth_as(self.viewer_user)
        response = self.client.patch(self._url(), {"name": "Hack"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MembershipRoleAssignViewTest(RBACViewBaseTest):
    def setUp(self):
        super().setUp()
        self.target_user = User.objects.create_user(
            email="target@example.com", password="pass123"
        )
        self.target_user.email_verified_at = timezone.now()
        self.target_user.save()
        agent_role = Role.objects.get(organization=self.org, slug="agent")
        self.target_membership = Membership.objects.create(
            user=self.target_user,
            organization=self.org,
            role=agent_role,
            status=MembershipStatus.ACTIVE,
        )

    def _url(self, membership_id=None):
        mid = membership_id or self.target_membership.id
        return f"/api/v1/organizations/{self.org.id}/members/{mid}/role/"

    def test_owner_can_assign_role(self):
        self._auth_as(self.owner_user)
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        response = self.client.patch(
            self._url(), {"role_id": str(viewer_role.id)}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"]["slug"], "viewer")

    def test_owner_can_remove_role(self):
        self._auth_as(self.owner_user)
        response = self.client.patch(self._url(), {"role_id": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["role"])

    def test_viewer_cannot_assign_role(self):
        self._auth_as(self.viewer_user)
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        response = self.client.patch(
            self._url(), {"role_id": str(viewer_role.id)}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_nonexistent_membership_returns_404(self):
        import uuid

        self._auth_as(self.owner_user)
        response = self.client.patch(
            f"/api/v1/organizations/{self.org.id}/members/{uuid.uuid4()}/role/",
            {"role_id": None},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_role_rejected(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="pass123"
        )
        other_user.email_verified_at = timezone.now()
        other_user.save()
        other_org = OrganizationService.create_organization(
            user=other_user, name="Beta"
        )
        other_viewer = Role.objects.get(organization=other_org, slug="viewer")
        self._auth_as(self.owner_user)
        response = self.client.patch(
            self._url(), {"role_id": str(other_viewer.id)}, format="json"
        )
        # Role not found in this org → 400
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sole_owner_role_protected(self):
        """Owner cannot change their own role when they are the only owner."""
        self._auth_as(self.owner_user)
        agent_role = Role.objects.get(organization=self.org, slug="agent")
        response = self.client.patch(
            self._url(self.owner_membership.id),
            {"role_id": str(agent_role.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_assign_role(self):
        viewer_role = Role.objects.get(organization=self.org, slug="viewer")
        response = self.client.patch(
            self._url(), {"role_id": str(viewer_role.id)}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MemberListWithRBACTest(RBACViewBaseTest):
    """Verify member.view permission is required to list members."""

    def test_owner_can_list_members(self):
        self._auth_as(self.owner_user)
        response = self.client.get(f"/api/v1/organizations/{self.org.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_viewer_can_list_members(self):
        self._auth_as(self.viewer_user)
        response = self.client.get(f"/api/v1/organizations/{self.org.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_member_without_role_cannot_list_members(self):
        no_role_user = User.objects.create_user(
            email="norole@example.com", password="pass123"
        )
        no_role_user.email_verified_at = timezone.now()
        no_role_user.save()
        Membership.objects.create(
            user=no_role_user,
            organization=self.org,
            role=None,
            status=MembershipStatus.ACTIVE,
        )
        self._auth_as(no_role_user)
        response = self.client.get(f"/api/v1/organizations/{self.org.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_membership_response_includes_role(self):
        self._auth_as(self.owner_user)
        response = self.client.get(f"/api/v1/organizations/{self.org.id}/members/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        member = response.data[0]
        self.assertIn("role", member)

    def test_owner_can_add_member(self):
        new_user = User.objects.create_user(email="newmember@example.com", password="pass123")
        new_user.email_verified_at = timezone.now()
        new_user.save()
        agent_role = Role.objects.get(organization=self.org, slug="agent")

        self._auth_as(self.owner_user)
        response = self.client.post(
            f"/api/v1/organizations/{self.org.id}/members/",
            {"email": "newmember@example.com", "role_id": str(agent_role.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["email"], "newmember@example.com")
        self.assertEqual(response.data["role"]["slug"], "agent")

    def test_viewer_cannot_add_member(self):
        new_user = User.objects.create_user(email="another@example.com", password="pass123")
        new_user.email_verified_at = timezone.now()
        new_user.save()

        self._auth_as(self.viewer_user)
        response = self.client.post(
            f"/api/v1/organizations/{self.org.id}/members/",
            {"email": "another@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_suspend_and_reactivate_member(self):
        self._auth_as(self.owner_user)
        # Suspend viewer
        response = self.client.patch(
            f"/api/v1/organizations/{self.org.id}/members/{self.viewer_membership.id}/",
            {"status": "SUSPENDED"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "SUSPENDED")

        # Reactivate viewer
        response = self.client.patch(
            f"/api/v1/organizations/{self.org.id}/members/{self.viewer_membership.id}/",
            {"status": "ACTIVE"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ACTIVE")

    def test_owner_cannot_suspend_sole_owner(self):
        self._auth_as(self.owner_user)
        response = self.client.patch(
            f"/api/v1/organizations/{self.org.id}/members/{self.owner_membership.id}/",
            {"status": "SUSPENDED"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_remove_member(self):
        self._auth_as(self.owner_user)
        response = self.client.delete(
            f"/api/v1/organizations/{self.org.id}/members/{self.viewer_membership.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_owner_cannot_remove_sole_owner(self):
        self._auth_as(self.owner_user)
        response = self.client.delete(
            f"/api/v1/organizations/{self.org.id}/members/{self.owner_membership.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

