from accounts.serializers import (
    EmailVerificationSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ResendVerificationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)
from accounts.services import AuthService
from django.contrib.auth import get_user_model

User = get_user_model()
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView


@extend_schema(tags=["Authentication"])
class RegisterView(APIView):
    """
    API endpoint for user registration.
    POST /api/v1/auth/register/
    """

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Register a new user",
        description=(
            "Creates a new user account and sends a verification email. "
            "User must verify their email before logging in. "
            "This endpoint is public — no authentication required."
        ),
        request=UserRegistrationSerializer,
        responses={
            201: OpenApiResponse(
                description="User created successfully. Verification email sent.",
                examples=[
                    OpenApiExample(
                        "Registration success",
                        value={
                            "message": "Registration successful. Please check your email to verify your account.",
                            "user": {
                                "id": "01906a2e-5b7c-7000-a1b2-c3d4e5f60001",
                                "email": "alemu@example.com",
                                "first_name": "Alemu",
                                "last_name": "Getu",
                                "is_active": True,
                            },
                        },
                    )
                ],
            ),
            400: OpenApiResponse(
                description="Validation error — invalid input or email already registered.",
                examples=[
                    OpenApiExample(
                        "Email already exists",
                        value={"email": ["A user with this email already exists."]},
                    ),
                    OpenApiExample(
                        "Password mismatch",
                        value={"password_confirm": ["Passwords do not match."]},
                    ),
                ],
            ),
        },
    )
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    "message": "Registration successful. Please check your email to verify your account.",
                    "user": UserProfileSerializer(user).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Authentication"])
class LoginView(APIView):
    """
    API endpoint for user login.
    POST /api/v1/auth/login/
    """

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Login",
        description=(
            "Authenticates a user by email and password and returns JWT tokens. "
            "This endpoint is public — no authentication required."
        ),
        request=UserLoginSerializer,
        responses={
            200: OpenApiResponse(
                description="Login successful. Returns access and refresh tokens.",
                examples=[
                    OpenApiExample(
                        "Login success",
                        value={
                            "access": "<jwt-access-token>",
                            "refresh": "<jwt-refresh-token>",
                        },
                    )
                ],
            ),
            401: OpenApiResponse(
                description="Authentication failed — invalid credentials or inactive account.",
                examples=[
                    OpenApiExample(
                        "Invalid credentials",
                        value={"non_field_errors": ["Invalid email or password."]},
                    )
                ],
            ),
        },
    )
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)


@extend_schema(tags=["Authentication"])
class LogoutView(APIView):
    """
    API endpoint for user logout.
    POST /api/v1/auth/logout/

    Blacklists the submitted refresh token. Access tokens remain valid until
    expiry; clients should discard both tokens locally after logout.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        summary="Logout",
        description=(
            "Blacklists the provided refresh token, preventing it from being used "
            "to generate new access tokens. The access token remains valid until "
            "its natural expiry — clients must discard it locally. "
            "**Requires authentication.**"
        ),
        request=LogoutSerializer,
        responses={
            200: OpenApiResponse(
                description="Logout successful.",
                examples=[
                    OpenApiExample(
                        "Logout success",
                        value={"message": "Successfully logged out."},
                    )
                ],
            ),
            400: OpenApiResponse(
                description="Invalid or already-blacklisted refresh token.",
                examples=[
                    OpenApiExample(
                        "Invalid token",
                        value={"non_field_errors": ["Invalid refresh token."]},
                    )
                ],
            ),
            401: OpenApiResponse(
                description="Authentication credentials not provided."
            ),
        },
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            AuthService.logout_user(serializer.validated_data["refresh"])
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"message": "Successfully logged out."}, status=status.HTTP_200_OK
        )


@extend_schema(
    tags=["Authentication"],
    summary="Refresh access token",
    description=(
        "Exchanges a valid refresh token for a new access token (and a new refresh "
        "token when ROTATE_REFRESH_TOKENS is enabled). The old refresh token is "
        "blacklisted after rotation. This endpoint is public — no authentication required."
    ),
    responses={
        200: OpenApiResponse(
            description="New tokens issued.",
            examples=[
                OpenApiExample(
                    "Token refresh success",
                    value={
                        "access": "<new-jwt-access-token>",
                        "refresh": "<new-jwt-refresh-token>",
                    },
                )
            ],
        ),
        401: OpenApiResponse(description="Refresh token is invalid or expired."),
    },
)
class TokenRefreshView(SimpleJWTTokenRefreshView):
    """
    API endpoint for token refresh.
    POST /api/v1/auth/token/refresh/
    """

    permission_classes = ()


@extend_schema(
    tags=["Authentication"],
    summary="Get authenticated user profile",
    description=(
        "Returns the profile of the currently authenticated user. "
        "**Requires authentication.**"
    ),
    responses={
        200: UserProfileSerializer,
        401: OpenApiResponse(description="Authentication credentials not provided."),
    },
)
class MeView(RetrieveAPIView):
    """
    API endpoint for the authenticated user's profile.
    GET /api/v1/auth/me/
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


@extend_schema(tags=["Authentication"])
class VerifyEmailView(APIView):
    """
    API endpoint for email verification.
    GET  /api/v1/auth/verify-email/?token=<token>   ← clicking the link in the email
    POST /api/v1/auth/verify-email/                 ← submitting via Swagger / API client
    """

    permission_classes = (AllowAny,)

    def _resolve_user_from_token(self, token: str):
        """
        Decode the token and return the matching User, or None on failure.
        Shared by both GET and POST handlers.
        """
        from accounts.email_services import email_verification_token_generator
        from django.core import signing

        try:
            data = signing.loads(
                token,
                salt=email_verification_token_generator.salt,
                max_age=email_verification_token_generator.timeout,
            )
            user_id = data.get("user_id")
            return User.objects.get(id=user_id)
        except (signing.BadSignature, signing.SignatureExpired, User.DoesNotExist):
            return None

    @extend_schema(
        summary="Verify email via link (GET)",
        description=(
            "Handles email verification when a user clicks the link in the "
            "verification email. The token is passed as a query parameter. "
            "Returns a plain JSON confirmation — no redirect, no frontend required."
        ),
        parameters=[
            OpenApiParameter(
                name="token",
                location=OpenApiParameter.QUERY,
                required=True,
                type=str,
                description="Secure verification token from the email link.",
            )
        ],
        responses={
            200: OpenApiResponse(description="Email verified successfully."),
            400: OpenApiResponse(description="Invalid or expired token."),
        },
    )
    def get(self, request):
        """Handle clicking the verification link from the email."""
        token = request.query_params.get("token", "").strip()
        if not token:
            return Response(
                {"token": ["Verification token is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = self._resolve_user_from_token(token)
        if not user:
            return Response(
                {"token": ["Invalid or expired verification token."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            AuthService.verify_email(user, token)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Email verified successfully. You can now log in.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Verify email via POST (API clients / Swagger)",
        description=(
            "Verifies a user's email address using a secure token. "
            "Use this when submitting the token programmatically. "
            "This endpoint is public — no authentication required."
        ),
        request=EmailVerificationSerializer,
        responses={
            200: OpenApiResponse(
                description="Email verified successfully.",
                examples=[
                    OpenApiExample(
                        "Verification success",
                        value={"message": "Email verified successfully. You can now log in."},
                    )
                ],
            ),
            400: OpenApiResponse(
                description="Invalid or expired token.",
                examples=[
                    OpenApiExample(
                        "Invalid token",
                        value={"token": ["Invalid or expired verification token."]},
                    )
                ],
            ),
        },
    )
    def post(self, request):
        """Handle verification submitted via API body (Swagger / mobile / SPA)."""
        serializer = EmailVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data["token"]

        user = self._resolve_user_from_token(token)
        if not user:
            return Response(
                {"token": ["Invalid or expired verification token."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            AuthService.verify_email(user, token)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Email verified successfully. You can now log in.",
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["Authentication"])
class ResendVerificationView(APIView):
    """
    API endpoint for resending verification email.
    POST /api/v1/auth/resend-verification/
    """

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Resend verification email",
        description=(
            "Resends a verification email to the user. "
            "For security, returns a generic response regardless of whether the email exists. "
            "This endpoint is public — no authentication required."
        ),
        request=ResendVerificationSerializer,
        responses={
            200: OpenApiResponse(
                description="If the email exists and is unverified, a verification email will be sent.",
                examples=[
                    OpenApiExample(
                        "Generic response",
                        value={
                            "message": "If the email exists and is unverified, a verification email has been sent."
                        },
                    )
                ],
            ),
            400: OpenApiResponse(description="Invalid email format."),
        },
    )
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()

        try:
            user = User.objects.get(email=email)
            try:
                AuthService.resend_verification_email(user)
            except ValidationError:
                # User already verified - return generic response for security
                pass
        except User.DoesNotExist:
            # Email doesn't exist - return generic response for security
            pass

        return Response(
            {
                "message": "If the email exists and is unverified, a verification email has been sent."
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["Authentication"])
class PasswordResetRequestView(APIView):
    """
    API endpoint for requesting password reset.
    POST /api/v1/auth/password-reset/request/
    """

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Request password reset",
        description=(
            "Sends a password reset email to the user. "
            "For security, returns a generic response regardless of whether the email exists. "
            "This endpoint is public — no authentication required."
        ),
        request=PasswordResetRequestSerializer,
        responses={
            200: OpenApiResponse(
                description="If the email exists, a password reset email will be sent.",
                examples=[
                    OpenApiExample(
                        "Generic response",
                        value={
                            "message": "If the email exists, a password reset email has been sent."
                        },
                    )
                ],
            ),
            400: OpenApiResponse(description="Invalid email format."),
        },
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        AuthService.request_password_reset(email)

        return Response(
            {"message": "If the email exists, a password reset email has been sent."},
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["Authentication"])
class PasswordResetConfirmView(APIView):
    """
    API endpoint for confirming password reset.
    GET  /api/v1/auth/password-reset/confirm/?token=<token>&user_id=<id>
         ← user clicks the link in the reset email; shows token/user_id
           so they can copy them into the POST body in Swagger.
    POST /api/v1/auth/password-reset/confirm/
         ← submits the actual new password.
    """

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Password reset confirm — validate link (GET)",
        description=(
            "Called when a user clicks the reset link in the email. "
            "Validates the token and returns the token + user_id to use "
            "in the POST body to complete the reset."
        ),
        parameters=[
            OpenApiParameter(
                name="token",
                location=OpenApiParameter.QUERY,
                required=True,
                type=str,
                description="Password reset token from the email link.",
            ),
            OpenApiParameter(
                name="user_id",
                location=OpenApiParameter.QUERY,
                required=True,
                type=str,
                description="User UUID from the email link.",
            ),
        ],
        responses={
            200: OpenApiResponse(description="Token is valid. Use the POST endpoint to set a new password."),
            400: OpenApiResponse(description="Invalid or expired token."),
        },
    )
    def get(self, request):
        """
        Validate the reset link from the email.
        Returns token + user_id so the user can complete the reset
        via POST (Swagger, API client, or future frontend form).
        """
        from accounts.email_services import password_reset_token_generator

        token = request.query_params.get("token", "").strip()
        user_id = request.query_params.get("user_id", "").strip()

        if not token or not user_id:
            return Response(
                {"detail": "token and user_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            return Response(
                {"user_id": ["Invalid user ID."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not password_reset_token_generator.check_token(user, token):
            return Response(
                {"token": ["Invalid or expired password reset token."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": (
                    "Token is valid. Submit a POST request to this endpoint "
                    "with token, user_id, new_password, and new_password_confirm "
                    "to complete the password reset."
                ),
                "token": token,
                "user_id": user_id,
                "post_url": request.build_absolute_uri(
                    "/api/v1/auth/password-reset/confirm/"
                ),
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Confirm password reset (POST)",
        description=(
            "Resets the user's password using a secure token sent via email. "
            "This endpoint is public — no authentication required."
        ),
        request=PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(
                description="Password reset successfully.",
                examples=[
                    OpenApiExample(
                        "Reset success",
                        value={"message": "Password reset successfully."},
                    )
                ],
            ),
            400: OpenApiResponse(
                description="Invalid token, expired token, or invalid password.",
                examples=[
                    OpenApiExample(
                        "Invalid token",
                        value={"token": ["Invalid or expired password reset token."]},
                    ),
                    OpenApiExample(
                        "Password mismatch",
                        value={"new_password_confirm": ["Passwords do not match."]},
                    ),
                ],
            ),
        },
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]
        user_id = serializer.validated_data["user_id"]

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"user_id": ["Invalid user ID."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            AuthService.confirm_password_reset(user, token, new_password)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"message": "Password reset successfully."},
            status=status.HTTP_200_OK,
        )
