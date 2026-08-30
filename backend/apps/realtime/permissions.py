"""
WebSocket connection permissions for real-time operations.

Enforces multi-tenant security by validating authentication,
organization membership, and operational access permissions.
"""

import logging
from typing import TYPE_CHECKING, Any

from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from organizations.models import Membership, Organization
from organizations.services import OrganizationService
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from accounts.models import User
else:
    User = get_user_model()

# The browser WebSocket API cannot set the Authorization header on the
# handshake. When the header is unavailable the client may instead offer the
# JWT as a Sec-WebSocket-Protocol subprotocol prefixed with this value. The
# subprotocol path is dev/demo-only and must be explicitly enabled by setting
# REALTIME_ALLOW_SUBPROTOCOL_AUTH = True (see config/settings/development.py);
# production deployments must authenticate via the Authorization header (e.g.
# through a gateway/proxy that injects it).
SUBPROTOCOL_AUTH_PREFIX = "pulsedesk.realtime."


class WebSocketAuthenticationError(Exception):
    """Raised when WebSocket authentication fails."""

    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(message)


class WebSocketPermissionError(Exception):
    """Raised when WebSocket authorization fails."""

    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(message)


def extract_bearer_token(scope: dict[str, Any]) -> str | None:
    """
    Extract the JWT from the connection scope.

    Prefers the Authorization header (the production transport). Falls back to
    the offered Sec-WebSocket-Protocol subprotocol only when
    REALTIME_ALLOW_SUBPROTOCOL_AUTH is enabled, so browser-based development
    can authenticate without a header-capable gateway.
    """
    headers = scope.get("headers", [])
    for header_name, header_value in headers:
        if header_name.decode().lower() == "authorization":
            auth_header = header_value.decode()
            if auth_header.startswith("Bearer "):
                return auth_header[7:]

    if not getattr(settings, "REALTIME_ALLOW_SUBPROTOCOL_AUTH", False):
        return None

    for subprotocol in scope.get("subprotocols", []):
        lowered = subprotocol.lower()
        if lowered.startswith(SUBPROTOCOL_AUTH_PREFIX):
            return subprotocol[len(SUBPROTOCOL_AUTH_PREFIX):]

    return None


@database_sync_to_async
def authenticate_websocket_connection(
    scope: dict[str, Any],
) -> tuple["User", Organization, Membership]:
    """
    Authenticate and authorize a WebSocket connection.

    Validates:
    1. JWT token authentication
    2. Organization existence and active status
    3. User's active membership in the organization
    4. User's permission to view operational data

    Returns:
        Tuple of (user, organization, membership)

    Raises:
        WebSocketAuthenticationError: If authentication fails
        WebSocketPermissionError: If authorization fails
    """
    # Extract JWT token from the Authorization header (production transport)
    # or, when enabled, from the offered Sec-WebSocket-Protocol subprotocol
    # (development transport for browsers).
    token = extract_bearer_token(scope)

    if not token:
        raise WebSocketAuthenticationError(
            "Authentication token required", "missing_token"
        )

    # Validate JWT token
    try:
        jwt_auth = JWTAuthentication()
        validated_token = jwt_auth.get_validated_token(token)
        user = jwt_auth.get_user(validated_token)

        if not user.is_active:
            raise WebSocketAuthenticationError(
                "User account is disabled", "user_disabled"
            )

        if not user.is_verified:
            raise WebSocketAuthenticationError(
                "Email verification required", "email_not_verified"
            )

    except (InvalidToken, TokenError) as e:
        logger.warning(
            "WebSocket authentication failed",
            extra={"error": str(e), "code": "invalid_token"},
        )
        raise WebSocketAuthenticationError(
            "Invalid authentication token", "invalid_token"
        ) from e

    # Extract organization_id from URL route
    path_components = scope.get("path", "").split("/")
    organization_id = None

    # Expected path format: /ws/v1/organizations/{organization_id}/operations/
    try:
        if "organizations" in path_components:
            org_index = path_components.index("organizations")
            if org_index + 1 < len(path_components):
                organization_id = path_components[org_index + 1]
    except (ValueError, IndexError):
        pass

    if not organization_id:
        raise WebSocketPermissionError(
            "Organization ID required in URL", "missing_organization"
        )

    # Validate organization and membership
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        raise WebSocketPermissionError(
            "Organization not found", "organization_not_found"
        ) from None

    try:
        membership = OrganizationService.validate_organization_access(
            user, organization
        )
    except Exception as e:
        logger.warning(
            "WebSocket organization access denied",
            extra={
                "user_id": str(user.id),
                "organization_id": organization_id,
                "error": str(e),
            },
        )
        raise WebSocketPermissionError(
            "Organization access denied", "access_denied"
        ) from e

    # Check operational dashboard access permission
    # This reuses the existing RBAC system
    from organizations.selectors import user_has_permission

    if not user_has_permission(user, organization, "incident.view"):
        logger.warning(
            "WebSocket operational access denied - insufficient permissions",
            extra={
                "user_id": str(user.id),
                "organization_id": organization_id,
            },
        )
        raise WebSocketPermissionError(
            "Insufficient permissions for operational data", "permission_denied"
        )

    return user, organization, membership
