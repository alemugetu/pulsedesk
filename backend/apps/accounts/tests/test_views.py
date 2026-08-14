from accounts.email_services import email_verification_token_generator
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class AuthViewTest(TestCase):
    """Test cases for authentication views."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        # Mark user as verified for login tests
        from django.utils import timezone

        self.user.email_verified_at = timezone.now()
        self.user.save(update_fields=["email_verified_at"])

    def _login(self, email="test@example.com", password="testpass123"):
        return self.client.post(
            "/api/v1/auth/login/",
            {"email": email, "password": password},
            format="json",
        )

    def test_user_registration(self):
        data = {
            "email": "newuser@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
        }
        response = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("message", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["email"], "newuser@example.com")
        # Check that verification email was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verify", mail.outbox[0].subject.lower())

    def test_registration_invalid_email(self):
        data = {
            "email": "not-an-email",
            "password": "newpass123",
            "password_confirm": "newpass123",
        }
        response = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_registration_weak_password(self):
        data = {
            "email": "weak@example.com",
            "password": "123",
            "password_confirm": "123",
        }
        response = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_registration_password_mismatch(self):
        data = {
            "email": "mismatch@example.com",
            "password": "newpass123",
            "password_confirm": "differentpass",
        }
        response = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_registration_duplicate_email(self):
        data = {
            "email": "test@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
        }
        response = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_user_login(self):
        response = self._login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        # Verify that user is marked as verified in response
        # (This is tested separately in test_me_authenticated)

    def test_user_login_invalid_credentials(self):
        response = self._login(password="wrongpass")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verification_email_content(self):
        """Test that verification email contains expected content."""
        data = {
            "email": "verify@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
        }
        mail.outbox = []  # Clear previous emails
        self.client.post("/api/v1/auth/register/", data, format="json")

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("verify", email.subject.lower())
        self.assertIn("verify@example.com", email.to)
        self.assertIn("PulseDesk", email.body)
        self.assertIn("verify-email", email.body)

    def test_user_login_unknown_email(self):
        response = self._login(email="unknown@example.com")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_registered_user_cannot_login_until_verified(self):
        """Test that newly registered users cannot login until verified."""
        data = {
            "email": "newuser@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
        }
        self.client.post("/api/v1/auth/register/", data, format="json")

        # Try to login immediately after registration
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "newuser@example.com", "password": "newpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("verify your email", response.data["non_field_errors"][0].lower())

    def test_user_can_login_after_verification(self):
        """Test that users can login after email verification."""
        data = {
            "email": "newuser@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
        }
        registration_response = self.client.post(
            "/api/v1/auth/register/", data, format="json"
        )
        user_id = registration_response.data["user"]["id"]

        # Get the verification token from the email
        from accounts.email_services import email_verification_token_generator

        # Extract token from the email (simplified - in real test we'd parse the email)
        user = User.objects.get(id=user_id)
        token = email_verification_token_generator.make_token(user)

        # Verify the email
        self.client.post(
            "/api/v1/auth/verify-email/",
            {"token": token},
            format="json",
        )

        # Now login should work
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "newuser@example.com", "password": "newpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_user_login_inactive_user(self):
        inactive_user = User.objects.create_user(
            email="inactive@example.com",
            password="testpass123",
        )
        inactive_user.is_active = False
        inactive_user.save(update_fields=["is_active"])

        response = self._login(email="inactive@example.com")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_authenticated(self):
        login_response = self._login()
        token = login_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "test@example.com")
        self.assertNotIn("password", response.data)
        self.assertTrue(response.data["is_verified"])

    def test_me_unauthenticated(self):
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_correct_user(self):
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        # Mark other user as verified
        from django.utils import timezone

        other_user.email_verified_at = timezone.now()
        other_user.save(update_fields=["email_verified_at"])

        login_response = self._login(email="other@example.com")
        token = login_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], other_user.email)
        self.assertNotEqual(response.data["email"], self.user.email)

    def test_token_refresh(self):
        login_response = self._login()
        refresh_token = login_response.data["refresh"]

        response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_token_refresh_invalid_token(self):
        response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": "invalid-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout(self):
        login_response = self._login()
        access_token = login_response.data["access"]
        refresh_token = login_response.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_logout_blacklists_refresh_token(self):
        login_response = self._login()
        access_token = login_response.data["access"]
        refresh_token = login_response.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        logout_response = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalid_refresh_token(self):
        login_response = self._login()
        access_token = login_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": "invalid-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_unverified_email(self):
        """Test that unverified users cannot login."""
        unverified_user = User.objects.create_user(
            email="unverified@example.com",
            password="testpass123",
        )
        # Ensure user is not verified
        unverified_user.email_verified_at = None
        unverified_user.save(update_fields=["email_verified_at"])

        response = self._login(email="unverified@example.com")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("verify your email", response.data["non_field_errors"][0].lower())

    def test_email_verification_valid_token(self):
        """Test successful email verification."""
        unverified_user = User.objects.create_user(
            email="unverified@example.com",
            password="testpass123",
        )
        token = email_verification_token_generator.make_token(unverified_user)

        response = self.client.post(
            "/api/v1/auth/verify-email/",
            {"token": token},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        unverified_user.refresh_from_db()
        self.assertIsNotNone(unverified_user.email_verified_at)

    def test_email_verification_invalid_token(self):
        """Test email verification with invalid token."""
        response = self.client.post(
            "/api/v1/auth/verify-email/",
            {"token": "invalid-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("token", response.data)

    def test_email_verification_already_verified(self):
        """Test that already verified users can re-verify (idempotent)."""
        token = email_verification_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/v1/auth/verify-email/",
            {"token": token},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_resend_verification_unverified_user(self):
        """Test resending verification email for unverified user."""
        User.objects.create_user(
            email="unverified@example.com",
            password="testpass123",
        )
        mail.outbox = []  # Clear previous emails

        response = self.client.post(
            "/api/v1/auth/resend-verification/",
            {"email": "unverified@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verify", mail.outbox[0].subject.lower())

    def test_resend_verification_verified_user(self):
        """Test resending verification email for already verified user (generic response)."""
        mail.outbox = []  # Clear previous emails

        response = self.client.post(
            "/api/v1/auth/resend-verification/",
            {"email": "test@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Generic response - no email sent for already verified user
        self.assertEqual(len(mail.outbox), 0)

    def test_resend_verification_nonexistent_email(self):
        """Test resending verification email for non-existent email (generic response)."""
        mail.outbox = []  # Clear previous emails

        response = self.client.post(
            "/api/v1/auth/resend-verification/",
            {"email": "nonexistent@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Generic response - no email sent for non-existent email
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_request_existing_email(self):
        """Test password reset request for existing email."""
        mail.outbox = []  # Clear previous emails

        response = self.client.post(
            "/api/v1/auth/password-reset/request/",
            {"email": "test@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset", mail.outbox[0].subject.lower())

    def test_password_reset_request_nonexistent_email(self):
        """Test password reset request for non-existent email (generic response)."""
        mail.outbox = []  # Clear previous emails

        response = self.client.post(
            "/api/v1/auth/password-reset/request/",
            {"email": "nonexistent@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Generic response - no email sent for non-existent email
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_confirm_valid_token(self):
        """Test successful password reset with valid token."""
        from accounts.email_services import password_reset_token_generator

        token = password_reset_token_generator.make_token(self.user)
        new_password = "newpass456"

        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "user_id": str(self.user.id),
                "token": token,
                "new_password": new_password,
                "new_password_confirm": new_password,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

    def test_password_reset_confirm_invalid_token(self):
        """Test password reset with invalid token."""
        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "user_id": str(self.user.id),
                "token": "invalid-token",
                "new_password": "newpass456",
                "new_password_confirm": "newpass456",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("token", response.data)

    def test_password_reset_confirm_password_mismatch(self):
        """Test password reset with mismatched passwords."""
        from accounts.email_services import password_reset_token_generator

        token = password_reset_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "user_id": str(self.user.id),
                "token": token,
                "new_password": "newpass456",
                "new_password_confirm": "differentpass",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password_confirm", response.data)

    def test_password_reset_confirm_invalid_user_id(self):
        """Test password reset with invalid user ID."""
        import uuid

        from accounts.email_services import password_reset_token_generator

        token = password_reset_token_generator.make_token(self.user)
        fake_user_id = uuid.uuid4()

        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "user_id": str(fake_user_id),
                "token": token,
                "new_password": "newpass456",
                "new_password_confirm": "newpass456",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("user_id", response.data)
