from common.models import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class OrganizationStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    ARCHIVED = 'ARCHIVED', 'Archived'


class MembershipStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    REMOVED = 'REMOVED', 'Removed'


class Organization(BaseModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    status = models.CharField(
        max_length=20,
        choices=OrganizationStatus.choices,
        default=OrganizationStatus.ACTIVE,
    )

    class Meta:
        db_table = 'organizations'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.name

    @staticmethod
    def normalize_slug(value: str) -> str:
        return slugify(value).lower()


class Membership(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )

    class Meta:
        db_table = 'organization_memberships'
        verbose_name = 'Membership'
        verbose_name_plural = 'Memberships'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'organization'],
                name='unique_user_organization_membership',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f'{self.user_id} -> {self.organization_id} ({self.status})'
