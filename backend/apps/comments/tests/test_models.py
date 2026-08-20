from comments.models import Comment
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from incidents.services import IncidentService
from organizations.services import OrganizationService

User = get_user_model()


class CommentModelTest(TestCase):
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

    def test_comment_creation(self):
        comment = Comment.objects.create(
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
        self.assertIsNotNone(comment.created_at)
        self.assertIsNotNone(comment.updated_at)

    def test_comment_internal_note(self):
        comment = Comment.objects.create(
            incident=self.incident,
            author=self.user,
            body="Internal note",
            is_internal=True,
        )
        self.assertTrue(comment.is_internal)

    def test_comment_empty_body_validation(self):
        comment = Comment(
            incident=self.incident,
            author=self.user,
            body="",
            is_internal=False,
        )
        with self.assertRaises(ValidationError):
            comment.clean()

    def test_comment_whitespace_body_validation(self):
        comment = Comment(
            incident=self.incident,
            author=self.user,
            body="   ",
            is_internal=False,
        )
        with self.assertRaises(ValidationError):
            comment.clean()

    def test_comment_mention_extraction(self):
        text = "Hey @john@example.com and @jane@example.com please review this"
        mentions = Comment.extract_mentions(text)
        self.assertEqual(len(mentions), 2)
        self.assertIn("john@example.com", mentions)
        self.assertIn("jane@example.com", mentions)

    def test_comment_mention_extraction_duplicates(self):
        text = "Hey @john@example.com and @john@example.com again"
        mentions = Comment.extract_mentions(text)
        self.assertEqual(len(mentions), 1)
        self.assertIn("john@example.com", mentions)

    def test_comment_mention_extraction_no_mentions(self):
        text = "No mentions here"
        mentions = Comment.extract_mentions(text)
        self.assertEqual(len(mentions), 0)

    def test_comment_mentioned_users_relationship(self):
        user2 = User.objects.create_user(
            email="mentioned@example.com", password="Password123!"
        )
        comment = Comment.objects.create(
            incident=self.incident,
            author=self.user,
            body="Test comment",
        )
        comment.mentioned_users.add(user2)
        self.assertEqual(comment.mentioned_users.count(), 1)
        self.assertIn(user2, comment.mentioned_users.all())

    def test_comment_str_representation(self):
        comment = Comment.objects.create(
            incident=self.incident,
            author=self.user,
            body="Test comment",
        )
        expected = f"Comment by {self.user.email} on {self.incident.incident_number}"
        self.assertEqual(str(comment), expected)
