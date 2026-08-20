from comments.permissions import (
    CanCreateComment,
    CanViewIncidentComments,
    IsCommentAuthorOrReadOnly,
)
from comments.services import CommentService
from django.contrib.auth import get_user_model
from django.test import TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService
from rest_framework.test import APIRequestFactory

User = get_user_model()


class CommentPermissionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com", password="Password123!"
        )
        self.org = OrganizationService.create_organization(
            user=self.user, name="Acme Corp"
        )
        self.incident = IncidentService.create_incident(
            organization=self.org,
            reporter_user=self.user,
            title="Test Incident",
            description="Test description",
        )
        self.comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Test comment",
            is_internal=False,
        )
        self.factory = APIRequestFactory()

    def test_is_comment_author_or_READONLY_read_access(self):
        # Any authenticated user should have read access
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other_user,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )

        request = self.factory.get("/api/v1/organizations/")
        request.user = other_user
        permission = IsCommentAuthorOrReadOnly()

        self.assertTrue(permission.has_object_permission(request, None, self.comment))

    def test_is_comment_author_or_READONLY_write_access_owner(self):
        # Comment author should have write access
        request = self.factory.patch("/api/v1/organizations/")
        request.user = self.user
        permission = IsCommentAuthorOrReadOnly()

        self.assertTrue(permission.has_object_permission(request, None, self.comment))

    def test_is_comment_author_or_READONLY_write_access_denied(self):
        # Non-author should not have write access
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other_user,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )

        request = self.factory.patch("/api/v1/organizations/")
        request.user = other_user
        permission = IsCommentAuthorOrReadOnly()

        self.assertFalse(permission.has_object_permission(request, None, self.comment))

    def test_can_view_incident_comments_authenticated(self):
        # Authenticated user with organization context should have access
        request = self.factory.get("/api/v1/organizations/")
        request.user = self.user
        request.organization = self.org
        permission = CanViewIncidentComments()

        self.assertTrue(permission.has_permission(request, None))

    def test_can_view_incident_comments_unauthenticated(self):
        # Unauthenticated user should not have access
        request = self.factory.get("/api/v1/organizations/")
        request.user = None
        permission = CanViewIncidentComments()

        self.assertFalse(permission.has_permission(request, None))

    def test_can_view_incident_comments_no_organization_context(self):
        # User without organization context should not have access
        request = self.factory.get("/api/v1/organizations/")
        request.user = self.user
        permission = CanViewIncidentComments()

        self.assertFalse(permission.has_permission(request, None))

    def test_can_create_comment_authenticated(self):
        # Authenticated user with organization context should have access
        request = self.factory.post("/api/v1/organizations/")
        request.user = self.user
        request.organization = self.org
        permission = CanCreateComment()

        self.assertTrue(permission.has_permission(request, None))

    def test_can_create_comment_unauthenticated(self):
        # Unauthenticated user should not have access
        request = self.factory.post("/api/v1/organizations/")
        request.user = None
        permission = CanCreateComment()

        self.assertFalse(permission.has_permission(request, None))

    def test_can_create_comment_no_organization_context(self):
        # User without organization context should not have access
        request = self.factory.post("/api/v1/organizations/")
        request.user = self.user
        permission = CanCreateComment()

        self.assertFalse(permission.has_permission(request, None))
