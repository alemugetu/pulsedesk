from django.db import transaction
from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    OrganizationStatus,
)
from rest_framework.exceptions import ValidationError


class OrganizationAccessValidationError(ValidationError):
    """Validation error that preserves a stable code for permission handling."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


class OrganizationService:
    """Business logic for organization and membership operations."""

    @staticmethod
    def generate_unique_slug(name: str, slug: str | None = None) -> str:
        base_slug = Organization.normalize_slug(slug or name)
        if not base_slug:
            raise OrganizationAccessValidationError(
                {'slug': ['A valid slug could not be generated.']},
                code='invalid_slug',
            )

        candidate = base_slug
        counter = 1
        while Organization.objects.filter(slug=candidate).exists():
            candidate = f'{base_slug}-{counter}'
            counter += 1
        return candidate

    @staticmethod
    @transaction.atomic
    def create_organization(user, name: str, slug: str | None = None) -> Organization:
        if not name or not name.strip():
            raise OrganizationAccessValidationError(
                {'name': ['Organization name is required.']},
                code='invalid_name',
            )

        normalized_slug = OrganizationService.generate_unique_slug(name.strip(), slug)

        organization = Organization.objects.create(
            name=name.strip(),
            slug=normalized_slug,
            status=OrganizationStatus.ACTIVE,
        )
        Membership.objects.create(
            user=user,
            organization=organization,
            status=MembershipStatus.ACTIVE,
        )
        return organization

    @staticmethod
    def validate_organization_access(user, organization: Organization) -> Membership:
        """
        Verify that a user may access an organization.

        Raises ValidationError with codes used by views to map to HTTP responses.
        """
        if organization.status != OrganizationStatus.ACTIVE:
            raise OrganizationAccessValidationError(
                {'detail': 'Organization is not accessible.'},
                code='organization_inactive',
            )

        try:
            membership = Membership.objects.get(user=user, organization=organization)
        except Membership.DoesNotExist:
            raise OrganizationAccessValidationError(
                {'detail': 'Organization not found.'},
                code='not_found',
            ) from None

        if membership.status == MembershipStatus.REMOVED:
            raise OrganizationAccessValidationError(
                {'detail': 'You do not have access to this organization.'},
                code='membership_removed',
            )

        if membership.status == MembershipStatus.SUSPENDED:
            raise OrganizationAccessValidationError(
                {'detail': 'Your membership in this organization is suspended.'},
                code='membership_suspended',
            )

        if membership.status != MembershipStatus.ACTIVE:
            raise OrganizationAccessValidationError(
                {'detail': 'You do not have access to this organization.'},
                code='membership_inactive',
            )

        return membership
