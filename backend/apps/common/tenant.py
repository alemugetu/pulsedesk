from typing import ClassVar

from common.models import BaseModel
from django.db import models
from organizations.models import Organization


class TenantScopedQuerySet(models.QuerySet):
    """QuerySet that requires explicit organization scoping."""

    def for_organization(self, organization):
        if organization is None:
            raise ValueError("organization is required for tenant-scoped queries")
        return self.filter(organization=organization)


class TenantScopedManager:
    """Utility manager for tenant-scoped models."""

    def for_organization(self, organization):
        if organization is None:
            raise ValueError("organization is required for tenant-scoped queries")
        return self


class TenantScopedDescriptor:
    def __get__(self, instance, owner):
        return TenantScopedManager()


class TenantScopedModel(BaseModel):
    """
    Abstract base for models that belong to a single organization.

    Future tenant-scoped models (Incident, Team, etc.) should inherit this
    and always query through for_organization() to prevent cross-tenant access.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
    )

    objects = TenantScopedDescriptor()

    class Meta:
        abstract = True
        indexes: ClassVar[tuple[models.Index, ...]] = (
            models.Index(fields=["organization"]),
        )
