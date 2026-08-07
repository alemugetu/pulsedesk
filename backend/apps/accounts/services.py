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

        return User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

    @staticmethod
    def login_user(email: str, password: str) -> dict:
        user = authenticate(email=email, password=password)

        if not user:
            raise ValidationError({"non_field_errors": ["Invalid email or password."]})

        if not user.is_active:
            raise ValidationError({"non_field_errors": ["User account is disabled."]})

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
