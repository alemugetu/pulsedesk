from accounts.email_services import (
    EmailService,
    email_verification_token_generator,
)
from accounts.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken


class AuthService:
    """
    Service layer for authentication operations.

    Logout strategy: refresh tokens are blacklisted via SimpleJWT's token
    blacklist app. Access tokens cannot be revoked server-side before expiry;
    clients must discard them locally on logout.
    """

    @staticmethod
    def register_user(
        email: str,
        password: str,
        first_name: str = "",
        last_name: str = "",
    ) -> User:
        email = email.lower()

        if User.objects.filter(email=email).exists():
            raise ValidationError({"email": ["A user with this email already exists."]})

        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise ValidationError({"password": list(exc.messages)}) from exc

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # Send verification email after successful user creation
        verification_token = email_verification_token_generator.make_token(user)
        EmailService.send_verification_email(user, verification_token)

        return user

    @staticmethod
    def login_user(email: str, password: str) -> dict:
        user = authenticate(email=email, password=password)

        if not user:
            raise ValidationError({"non_field_errors": ["Invalid email or password."]})

        if not user.is_active:
            raise ValidationError({"non_field_errors": ["User account is disabled."]})

        if not user.is_verified:
            raise ValidationError(
                {
                    "non_field_errors": [
                        "Please verify your email address before logging in."
                    ]
                }
            )

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

    @staticmethod
    def logout_user(refresh_token: str) -> None:
        try:
            token = RefreshToken(refresh_token)  # type: ignore[arg-type]
            token.blacklist()
        except Exception as exc:
            raise ValidationError(
                {"non_field_errors": ["Invalid refresh token."]}
            ) from exc

    @staticmethod
    def verify_email(user, token: str) -> None:
        """
        Verify user email using secure token.

        Args:
            user: User instance
            token: Email verification token

        Raises:
            ValidationError: If token is invalid or expired
        """
        if user.is_verified:
            # Already verified - no error needed for idempotency
            return

        if not email_verification_token_generator.check_token(user, token):
            raise ValidationError({"token": ["Invalid or expired verification token."]})

        from django.utils import timezone

        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at"])

    @staticmethod
    def resend_verification_email(user) -> str:
        """
        Resend verification email to user.

        Args:
            user: User instance

        Returns:
            New verification token

        Raises:
            ValidationError: If user is already verified
        """
        if user.is_verified:
            raise ValidationError({"email": ["Email is already verified."]})

        verification_token = email_verification_token_generator.make_token(user)
        EmailService.send_verification_email(user, verification_token)
        return verification_token

    @staticmethod
    def request_password_reset(email: str) -> None:
        """
        Request password reset for an email.
        Generic response for security - does not reveal if email exists.

        Args:
            email: User email address
        """
        from accounts.email_services import password_reset_token_generator

        try:
            user = User.objects.get(email=email.lower())
            reset_token = password_reset_token_generator.make_token(user)
            EmailService.send_password_reset_email(user, reset_token)
        except User.DoesNotExist:
            # Don't reveal if email exists - generic response
            pass

    @staticmethod
    def confirm_password_reset(user, token: str, new_password: str) -> None:
        """
        Confirm password reset using secure token.

        Args:
            user: User instance
            token: Password reset token
            new_password: New password to set

        Raises:
            ValidationError: If token is invalid or password fails validation
        """
        from accounts.email_services import password_reset_token_generator

        if not password_reset_token_generator.check_token(user, token):
            raise ValidationError(
                {"token": ["Invalid or expired password reset token."]}
            )

        try:
            validate_password(new_password)
        except DjangoValidationError as exc:
            raise ValidationError({"password": list(exc.messages)}) from exc

        user.set_password(new_password)
        user.save(update_fields=["password"])
