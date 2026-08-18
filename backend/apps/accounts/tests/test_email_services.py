from accounts.email_services import (
    EmailService,
    email_verification_token_generator,
    password_reset_token_generator,
)
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase

User = get_user_model()


class EmailVerificationTokenGeneratorTest(TestCase):
    """Test cases for email verification token generation and validation."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )

    def test_make_token(self):
        """Test that token generation creates a non-empty string."""
        token = email_verification_token_generator.make_token(self.user)
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 0)

    def test_check_token_valid(self):
        """Test that valid token passes validation."""
        token = email_verification_token_generator.make_token(self.user)
        self.assertTrue(
            email_verification_token_generator.check_token(self.user, token)
        )

    def test_check_token_invalid(self):
        """Test that invalid token fails validation."""
        self.assertFalse(
            email_verification_token_generator.check_token(self.user, "invalid-token")
        )

    def test_check_token_wrong_user(self):
        """Test that token from one user doesn't work for another."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        token = email_verification_token_generator.make_token(self.user)
        self.assertFalse(
            email_verification_token_generator.check_token(other_user, token)
        )

    def test_token_expiration(self):
        """Test that token expires after timeout."""
        from unittest.mock import patch

        token = email_verification_token_generator.make_token(self.user)

        # Mock the timeout to be very short for testing
        with patch.object(email_verification_token_generator, "timeout", 0):
            self.assertFalse(
                email_verification_token_generator.check_token(self.user, token)
            )


class EmailServiceTest(TestCase):
    """Test cases for email service functionality."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        mail.outbox = []

    def test_send_verification_email(self):
        """Test that verification email is sent correctly."""
        token = "test-token-123"
        EmailService.send_verification_email(self.user, token)

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("verify", email.subject.lower())
        self.assertEqual(email.to, [self.user.email])
        self.assertIn(token, email.body)
        self.assertIn("PulseDesk", email.body)

    def test_send_password_reset_email(self):
        """Test that password reset email is sent correctly."""
        token = "reset-token-456"
        EmailService.send_password_reset_email(self.user, token)

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("reset", email.subject.lower())
        self.assertEqual(email.to, [self.user.email])
        self.assertIn(token, email.body)
        self.assertIn("PulseDesk", email.body)

    def test_verification_email_contains_link(self):
        """Test that verification email contains the verification link."""
        token = "test-token-123"
        EmailService.send_verification_email(self.user, token)

        email = mail.outbox[0]
        self.assertIn("verify-email", email.body)
        self.assertIn(token, email.body)

    def test_password_reset_email_contains_link(self):
        """Test that password reset email contains the reset link."""
        token = "reset-token-456"
        EmailService.send_password_reset_email(self.user, token)

        email = mail.outbox[0]
        self.assertIn("password-reset", email.body)
        self.assertIn(token, email.body)
        self.assertIn(str(self.user.id), email.body)


class PasswordResetTokenGeneratorTest(TestCase):
    """Test cases for Django's password reset token generator."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )

    def test_make_token(self):
        """Test that password reset token generation works."""
        token = password_reset_token_generator.make_token(self.user)
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 0)

    def test_check_token_valid(self):
        """Test that valid password reset token passes validation."""
        token = password_reset_token_generator.make_token(self.user)
        self.assertTrue(password_reset_token_generator.check_token(self.user, token))

    def test_check_token_invalid(self):
        """Test that invalid password reset token fails validation."""
        self.assertFalse(
            password_reset_token_generator.check_token(self.user, "invalid-token")
        )

    def test_check_token_wrong_user(self):
        """Test that password reset token from one user doesn't work for another."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        token = password_reset_token_generator.make_token(self.user)
        self.assertFalse(password_reset_token_generator.check_token(other_user, token))

    def test_token_invalid_after_password_change(self):
        """Test that password reset token becomes invalid after password change."""
        token = password_reset_token_generator.make_token(self.user)

        # Change password
        self.user.set_password("newpassword123")
        self.user.save()

        # Token should now be invalid
        self.assertFalse(password_reset_token_generator.check_token(self.user, token))
