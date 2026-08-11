from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    OrganizationStatus,
    Permission,
    Role,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Organization selectors
# ---------------------------------------------------------------------------


def get_organization_by_id(organization_id):
    try:
        return Organization.objects.get(id=organization_id)
    except (Organization.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def list_user_organizations(user):
    return (
        Organization.objects.filter(
            memberships__user=user,
            memberships__status=MembershipStatus.ACTIVE,
            status=OrganizationStatus.ACTIVE,
        )
        .distinct()
        .order_by("name")
    )


# ---------------------------------------------------------------------------
# Membership selectors
# ---------------------------------------------------------------------------


def get_active_membership(user, organization):
    try:
        return Membership.objects.select_related("user", "organization", "role").get(
            user=user,
            organization=organization,
        )
    except Membership.DoesNotExist:
        return None


def list_organization_members(organization):
    return (
        Membership.objects.filter(
            organization=organization,
            status=MembershipStatus.ACTIVE,
        )
        .select_related("user", "role")
        .order_by("created_at")
    )


def user_has_active_membership(user, organization) -> bool:
    return Membership.objects.filter(
        user=user,
        organization=organization,
        status=MembershipStatus.ACTIVE,
    ).exists()


def get_membership_by_id(membership_id, organization):
    """Return a membership within the given organization, or None."""
    try:
        return Membership.objects.select_related("user", "role").get(
            id=membership_id,
            organization=organization,
        )
    except (Membership.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Role selectors
# ---------------------------------------------------------------------------


def get_organization_roles(organization):
    """Return all roles for an organization, prefetching permissions."""
    return (
        Role.objects.filter(organization=organization)
        .prefetch_related("permissions")
        .order_by("name")
    )


def get_role_by_id(role_id, organization):
    """Return a role within the given organization, or None."""
    try:
        return Role.objects.prefetch_related("permissions").get(
            id=role_id,
            organization=organization,
        )
    except (Role.DoesNotExist, DjangoValidationError, TypeError, ValueError):
        return None


def get_membership_role(membership) -> Role | None:
    """Return the role attached to a membership, or None."""
    if membership is None:
        return None
    return membership.role


# ---------------------------------------------------------------------------
# Permission selectors
# ---------------------------------------------------------------------------


def get_all_permissions():
    return Permission.objects.all().order_by("resource", "action")


def get_permissions_by_codenames(codenames: list[str]):
    return Permission.objects.filter(codename__in=codenames)


def get_role_permissions(role: Role):
    return role.permissions.all()


# ---------------------------------------------------------------------------
# Authorization check
# ---------------------------------------------------------------------------


def user_has_permission(user, organization, codename: str) -> bool:
    """
    Central RBAC authorization check.

    Returns True only when ALL of the following hold:
      1. User is authenticated and active.
      2. User has an ACTIVE membership in the organization.
      3. The membership has a role assigned.
      4. The role contains a permission with the given codename.

    Suspended/Removed memberships always return False even if a role exists.
    A role from a different organization can never be attached (FK constraint),
    but the organization check on the role is an explicit defense-in-depth guard.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False

    try:
        membership = Membership.objects.select_related("role").get(
            user=user,
            organization=organization,
            status=MembershipStatus.ACTIVE,
        )
    except Membership.DoesNotExist:
        return False

    if membership.role is None:
        return False

    # Defense-in-depth: confirm the role belongs to the same org.
    if membership.role.organization_id != organization.pk:
        return False

    return membership.role.permissions.filter(codename=codename).exists()
