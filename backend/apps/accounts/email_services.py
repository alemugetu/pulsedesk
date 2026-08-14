from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import signing
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone


class EmailVerificationTokenGenerator:
    """
    Generates and validates secure email verification tokens using Django's signing module.
    Tokens include user ID, email, and timestamp for security and expiration.
    """

    def __init__(self):
        self.salt = "email_verification"
        self.timeout = settings.EMAIL_VERIFICATION_TIMEOUT

    def make_token(self, user) -> str:
        """Generate a secure token for email verification."""
        timestamp = timezone.now().timestamp()
        data = {
            "user_id": str(user.id),
            "email": user.email,
            "timestamp": timestamp,
        }
        return signing.dumps(data, salt=self.salt)

    def check_token(self, user, token: str) -> bool:
        """
        Validate the token and check expiration.
        Returns True if token is valid and not expired.
        """
        try:
            data = signing.loads(token, salt=self.salt, max_age=self.timeout)
            return (
                str(data.get("user_id")) == str(user.id)
                and data.get("email") == user.email
            )
        except (signing.BadSignature, signing.SignatureExpired):
            return False


password_reset_token_generator = PasswordResetTokenGenerator()


class EmailService:
    """
    Service layer for email operations.
    Handles email composition and sending for verification and password reset.
    """

    @staticmethod
    def send_verification_email(user, verification_token: str) -> None:
        """
        Send email verification email to user.

        The verification link points directly to the backend API endpoint.
        When a frontend is available, swap BACKEND_URL for FRONTEND_URL
        and update the path to the frontend route.
        """
        backend_url = getattr(settings, "BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
        verification_url = (
            f"{backend_url}/api/v1/auth/verify-email/?token={verification_token}"
        )

        context = {
            "user": user,
            "verification_url": verification_url,
            "token": verification_token,
        }

        html_content = render_to_string("emails/verification_email.html", context)
        text_content = render_to_string("emails/verification_email.txt", context)

        send_mail(
            subject="Verify Your Email Address - PulseDesk",
            message=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False,
        )

    @staticmethod
    def send_password_reset_email(user, reset_token: str) -> None:
        """
        Send password reset email to user.

        The reset link points directly to the backend API confirm endpoint.
        When a frontend is available, swap BACKEND_URL for FRONTEND_URL
        and update the path to the frontend route.
        """
        backend_url = getattr(settings, "BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
        reset_url = (
            f"{backend_url}/api/v1/auth/password-reset/confirm/"
            f"?token={reset_token}&user_id={user.id}"
        )

        context = {
            "user": user,
            "reset_url": reset_url,
            "token": reset_token,
            "user_id": str(user.id),
        }

        html_content = render_to_string("emails/password_reset_email.html", context)
        text_content = render_to_string("emails/password_reset_email.txt", context)

        send_mail(
            subject="Reset Your Password - PulseDesk",
            message=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False,
        )


email_verification_token_generator = EmailVerificationTokenGenerator()
