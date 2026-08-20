from comments.services import CommentService, CommentValidationError
from django.contrib.auth import get_user_model
from django.test import TestCase
from incidents.services import IncidentService
from organizations.models import Membership, MembershipStatus
from organizations.services import OrganizationService

User = get_user_model()


class CommentServiceTest(TestCase):
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
        self.membership = Membership.objects.get(user=self.user, organization=self.org)

    def test_create_comment_success(self):
        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="This is a test comment",
            is_internal=False,
        )
        self.assertIsNotNone(comment.id)
        self.assertEqual(comment.body, "This is a test comment")
        self.assertEqual(comment.author, self.user)
        self.assertEqual(comment.incident, self.incident)
        self.assertFalse(comment.is_internal)

    def test_create_comment_empty_body(self):
        with self.assertRaises(CommentValidationError) as cm:
            CommentService.create_comment(
                incident=self.incident,
                author=self.user,
                body="",
                is_internal=False,
            )
        self.assertEqual(cm.exception.code, "empty_body")

    def test_create_comment_whitespace_body(self):
        with self.assertRaises(CommentValidationError) as cm:
            CommentService.create_comment(
                incident=self.incident,
                author=self.user,
                body="   ",
                is_internal=False,
            )
        self.assertEqual(cm.exception.code, "empty_body")

    def test_create_comment_unauthorized_user(self):
        # User not in organization
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        with self.assertRaises(CommentValidationError) as cm:
            CommentService.create_comment(
                incident=self.incident,
                author=other_user,
                body="Test comment",
                is_internal=False,
            )
        self.assertEqual(cm.exception.code, "access_denied")

    def test_create_comment_with_valid_mentions(self):
        # Create another user in the same organization
        mentioned_user = User.objects.create_user(
            email="mentioned@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=mentioned_user,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )

        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Hey @mentioned@example.com please review",
            is_internal=False,
        )
        self.assertEqual(comment.mentioned_users.count(), 1)
        self.assertIn(mentioned_user, comment.mentioned_users.all())

    def test_create_comment_with_cross_tenant_mention(self):
        # Create user in different organization
        other_org = OrganizationService.create_organization(
            user=self.user, name="Other Corp"
        )
        external_user = User.objects.create_user(
            email="external@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=external_user,
            organization=other_org,
            status=MembershipStatus.ACTIVE,
        )

        with self.assertRaises(CommentValidationError) as cm:
            CommentService.create_comment(
                incident=self.incident,
                author=self.user,
                body="Hey @external@example.com please review",
                is_internal=False,
            )
        self.assertEqual(cm.exception.code, "invalid_mention")

    def test_create_comment_with_invalid_mention(self):
        # Mention non-existent user - should not fail comment creation
        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Hey @nonexistent@example.com please review",
            is_internal=False,
        )
        self.assertEqual(comment.mentioned_users.count(), 0)

    def test_update_own_comment_success(self):
        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Original comment",
            is_internal=False,
        )
        updated = CommentService.update_comment(
            comment=comment,
            author=self.user,
            body="Updated comment",
            is_internal=True,
        )
        self.assertEqual(updated.body, "Updated comment")
        self.assertTrue(updated.is_internal)

    def test_update_other_user_comment_denied(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other_user,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        comment = CommentService.create_comment(
            incident=self.incident,
            author=other_user,
            body="Other user's comment",
            is_internal=False,
        )
        with self.assertRaises(CommentValidationError) as cm:
            CommentService.update_comment(
                comment=comment,
                author=self.user,
                body="Trying to update",
                is_internal=False,
            )
        self.assertEqual(cm.exception.code, "not_owner")

    def test_update_comment_empty_body(self):
        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Original comment",
            is_internal=False,
        )
        with self.assertRaises(CommentValidationError) as cm:
            CommentService.update_comment(
                comment=comment,
                author=self.user,
                body="",
                is_internal=False,
            )
        self.assertEqual(cm.exception.code, "empty_body")

    def test_delete_own_comment_success(self):
        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Comment to delete",
            is_internal=False,
        )
        comment_id = comment.id
        CommentService.delete_comment(comment, self.user)
        # Verify comment is deleted
        from comments.models import Comment

        self.assertFalse(Comment.objects.filter(id=comment_id).exists())

    def test_delete_other_user_comment_denied(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        Membership.objects.create(
            user=other_user,
            organization=self.org,
            status=MembershipStatus.ACTIVE,
        )
        comment = CommentService.create_comment(
            incident=self.incident,
            author=other_user,
            body="Other user's comment",
            is_internal=False,
        )
        with self.assertRaises(CommentValidationError) as cm:
            CommentService.delete_comment(comment, self.user)
        self.assertEqual(cm.exception.code, "not_owner")
        # Verify comment still exists
        from comments.models import Comment

        self.assertTrue(Comment.objects.filter(id=comment.id).exists())
