from dataclasses import dataclass

from django.contrib.auth import get_user_model
from organizations.models import Membership, Organization

User = get_user_model()


@dataclass(frozen=True)
class TenantContext:
    """Request-scoped tenant context bound to an authenticated user."""

    user: User
    organization: Organization
    membership: Membership


def set_tenant_context(request, context: TenantContext) -> None:
    """Attach tenant context to the current request."""
    request._tenant_context = context
    request.organization = context.organization
    request.membership = context.membership


def get_tenant_context(request) -> TenantContext | None:
    """Return tenant context previously bound to the request."""
    return getattr(request, "_tenant_context", None)
