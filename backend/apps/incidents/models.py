from typing import ClassVar

from common.models import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify
from organizations.models import Membership, Organization


class IncidentCategory(BaseModel):
    """
    Organization-scoped category for classifying incidents.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="incident_categories",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "incident_categories"
        verbose_name = "Incident Category"
        verbose_name_plural = "Incident Categories"
        ordering: ClassVar = ["name"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="unique_category_slug_per_organization",
            ),
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_category_name_per_organization",
            ),
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["organization", "slug"]),
        ]

    def __str__(self) -> str:
        return f"{self.organization_id} / {self.name}"

    @staticmethod
    def normalize_slug(value: str) -> str:
        return slugify(value).lower()


class IncidentStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    RESOLVED = "RESOLVED", "Resolved"
    CLOSED = "CLOSED", "Closed"


class IncidentPriority(models.TextChoices):
    P1 = "P1", "P1 — Critical"
    P2 = "P2", "P2 — High"
    P3 = "P3", "P3 — Medium"
    P4 = "P4", "P4 — Low"


class Incident(BaseModel):
    """
    Central operational entity representing an incident within an organization.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="incidents",
    )
    incident_number = models.CharField(max_length=32)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=IncidentStatus.choices,
        default=IncidentStatus.OPEN,
    )
    priority = models.CharField(
        max_length=15,
        choices=IncidentPriority.choices,
        default=IncidentPriority.P3,
    )
    category = models.ForeignKey(
        IncidentCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="incidents",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reported_incidents",
    )
    assignee = models.ForeignKey(
        Membership,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_incidents",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "incidents"
        verbose_name = "Incident"
        verbose_name_plural = "Incidents"
        ordering: ClassVar = ["-created_at"]
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["organization", "incident_number"],
                name="unique_incident_number_per_organization",
            )
        ]
        indexes: ClassVar = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "priority"]),
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["organization", "incident_number"]),
            models.Index(fields=["organization", "assignee"]),
        ]

    def __str__(self) -> str:
        return f"{self.incident_number}: {self.title}"
