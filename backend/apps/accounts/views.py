from accounts.serializers import (
    LogoutSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)
from accounts.services import AuthService
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
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
            "Creates a new user account and returns JWT access and refresh tokens. "
            "This endpoint is public — no authentication required."
        ),
        request=UserRegistrationSerializer,
        responses={
            201: OpenApiResponse(
                description="User created successfully. Returns tokens and user profile.",
                examples=[
                    OpenApiExample(
                        "Registration success",
                        value={
                            "user": {
                                "id": "01906a2e-5b7c-7000-a1b2-c3d4e5f60001",
                                "email": "alice@example.com",
                                "first_name": "Alice",
                                "last_name": "Smith",
                                "is_active": True,
                            },
                            "access": "<jwt-access-token>",
                            "refresh": "<jwt-refresh-token>",
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
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "user": UserProfileSerializer(user).data,
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
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
