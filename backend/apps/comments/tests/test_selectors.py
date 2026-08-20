from comments.selectors import get_comment, get_comments
from comments.services import CommentService
from django.contrib.auth import get_user_model
from django.test import TestCase
from incidents.services import IncidentService
from organizations.services import OrganizationService

User = get_user_model()


class CommentSelectorTest(TestCase):
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

    def test_get_comments_for_incident(self):
        # Create multiple comments
        CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="First comment",
            is_internal=False,
        )
        CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Second comment",
            is_internal=True,
        )
        CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Third comment",
            is_internal=False,
        )

        comments = get_comments(self.incident)
        self.assertEqual(comments.count(), 3)

    def test_get_comments_empty_incident(self):
        comments = get_comments(self.incident)
        self.assertEqual(comments.count(), 0)

    def test_get_comment_by_id(self):
        created = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Test comment",
            is_internal=False,
        )
        retrieved = get_comment(self.incident, created.id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, created.id)
        self.assertEqual(retrieved.body, "Test comment")

    def test_get_comment_not_found(self):
        import uuid

        fake_id = uuid.uuid4()
        retrieved = get_comment(self.incident, fake_id)
        self.assertIsNone(retrieved)

    def test_get_comment_cross_tenant_isolation(self):
        # Create comment on incident in one organization
        comment = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Test comment",
            is_internal=False,
        )

        # Create another organization and incident
        other_user = User.objects.create_user(
            email="other@example.com", password="Password123!"
        )
        other_org = OrganizationService.create_organization(
            user=other_user, name="Other Corp"
        )
        other_incident = IncidentService.create_incident(
            organization=other_org,
            reporter_user=other_user,
            title="Other Incident",
            description="Other description",
        )

        # Try to get comment from different organization's incident
        retrieved = get_comment(other_incident, comment.id)
        self.assertIsNone(retrieved)

    def test_get_comments_ordering(self):
        # Create comments in sequence
        comment1 = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="First comment",
            is_internal=False,
        )
        comment2 = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Second comment",
            is_internal=False,
        )
        comment3 = CommentService.create_comment(
            incident=self.incident,
            author=self.user,
            body="Third comment",
            is_internal=False,
        )

        comments = list(get_comments(self.incident))
        self.assertEqual(comments[0].id, comment1.id)
        self.assertEqual(comments[1].id, comment2.id)
        self.assertEqual(comments[2].id, comment3.id)
