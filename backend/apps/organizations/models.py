from typing import ClassVar

from common.models import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class OrganizationStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    ARCHIVED = "ARCHIVED", "Archived"


class MembershipStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    REMOVED = "REMOVED", "Removed"


class Organization(BaseModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    status = models.CharField(
        max_length=20,
        choices=OrganizationStatus.choices,
        default=OrganizationStatus.ACTIVE,
    )

    class Meta:
        db_table = "organizations"
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        indexes: ClassVar = [
            models.Index(fields=["slug"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return self.name

    @staticmethod
    def normalize_slug(value: str) -> str:
        return slugify(value).lower()


class Permission(BaseModel):
    """
    A reusable application capability.

    Codenames follow the pattern  <resource>.<action>
    e.g. organization.view, member.invite, role.manage.
    Permissions are global (not organization-scoped) — they represent
    capabilities that roles grant inside an organization.
    """

    codename = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    resource = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "rbac_permissions"
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"
        ordering: ClassVar = ["resource", "action"]
        indexes: ClassVar = [
            models.Index(fields=["codename"]),
            models.Index(fields=["resource"]),
        ]

    def __str__(self) -> str:
        return self.codename


class Role(BaseModel):
    """
    An organization-scoped named set of permissions.

    Role names and slugs are unique within an organization but may
    be reused across different organizations.
    is_system_role=True marks built-in roles that must not be deleted
    or arbitrarily modified by organization members.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="roles",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_system_role = models.BooleanField(
        default=False,
        help_text="System roles are seeded automatically and cannot be deleted.",
    )
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
        through="RolePermission",
    )

    class Meta:
        db_table = "rbac_roles"
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="unique_role_slug_per_organization",
            ),
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_role_name_per_organization",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "slug"]),
            models.Index(fields=["organization", "is_system_role"]),
        ]

    def __str__(self) -> str:
        return f"{self.organization_id} / {self.name}"

    @staticmethod
    def normalize_slug(value: str) -> str:
        return slugify(value).lower()


class RolePermission(BaseModel):
    """
    Explicit through-table for Role ↔ Permission.
    Enforces uniqueness at the database level.
    """

    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="role_permissions"
    )
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions"
    )

    class Meta:
        db_table = "rbac_role_permissions"
        verbose_name = "Role Permission"
        verbose_name_plural = "Role Permissions"
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="unique_role_permission",
            )
        ]

    def __str__(self) -> str:
        return f"{self.role_id} → {self.permission_id}"


class Membership(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.ForeignKey(
        Role,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="memberships",
    )
    status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )

    class Meta:
        db_table = "organization_memberships"
        verbose_name = "Membership"
        verbose_name_plural = "Memberships"
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["user", "organization"],
                name="unique_user_organization_membership",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["organization", "role"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} -> {self.organization_id} ({self.status})"
