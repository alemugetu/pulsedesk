from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from organizations.models import Membership, Organization

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

User = get_user_model()


@dataclass(frozen=True)
class TenantContext:
    """Request-scoped tenant context bound to an authenticated user."""

    user: AbstractBaseUser
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
