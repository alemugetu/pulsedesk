from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    OrganizationStatus,
)

User = get_user_model()


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
        .order_by('name')
    )


def get_active_membership(user, organization):
    try:
        return Membership.objects.select_related('user', 'organization').get(
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
        .select_related('user')
        .order_by('created_at')
    )


def user_has_active_membership(user, organization) -> bool:
    return Membership.objects.filter(
        user=user,
        organization=organization,
        status=MembershipStatus.ACTIVE,
    ).exists()
