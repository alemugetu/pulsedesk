import uuid
from typing import ClassVar

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("organizations", "0002_rbac"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations: ClassVar[list] = [
        migrations.CreateModel(
            name="IncidentCategory",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("slug", models.SlugField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incident_categories",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "Incident Category",
                "verbose_name_plural": "Incident Categories",
                "db_table": "incident_categories",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Incident",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("incident_number", models.CharField(max_length=32)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("OPEN", "Open"),
                            ("ACKNOWLEDGED", "Acknowledged"),
                            ("IN_PROGRESS", "In Progress"),
                            ("RESOLVED", "Resolved"),
                            ("CLOSED", "Closed"),
                        ],
                        default="OPEN",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[
                            ("P1", "P1 — Critical"),
                            ("P2", "P2 — High"),
                            ("P3", "P3 — Medium"),
                            ("P4", "P4 — Low"),
                        ],
                        default="P3",
                        max_length=10,
                    ),
                ),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "assignee",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assigned_incidents",
                        to="organizations.membership",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incidents",
                        to="organizations.organization",
                    ),
                ),
                (
                    "reporter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="reported_incidents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incidents",
                        to="incidents.incidentcategory",
                    ),
                ),
            ],
            options={
                "verbose_name": "Incident",
                "verbose_name_plural": "Incidents",
                "db_table": "incidents",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="incidentcategory",
            index=models.Index(
                fields=["organization", "is_active"],
                name="incident_ca_organiz_b3dbc2_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="incidentcategory",
            index=models.Index(
                fields=["organization", "slug"], name="incident_ca_organiz_35372f_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="incidentcategory",
            constraint=models.UniqueConstraint(
                fields=("organization", "slug"),
                name="unique_category_slug_per_organization",
            ),
        ),
        migrations.AddConstraint(
            model_name="incidentcategory",
            constraint=models.UniqueConstraint(
                fields=("organization", "name"),
                name="unique_category_name_per_organization",
            ),
        ),
        migrations.AddIndex(
            model_name="incident",
            index=models.Index(
                fields=["organization", "status"], name="incidents_organiz_866fc8_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="incident",
            index=models.Index(
                fields=["organization", "priority"], name="incidents_organiz_8deb8a_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="incident",
            index=models.Index(
                fields=["organization", "created_at"],
                name="incidents_organiz_a02b3c_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="incident",
            index=models.Index(
                fields=["organization", "incident_number"],
                name="incidents_organiz_577a45_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="incident",
            index=models.Index(
                fields=["organization", "assignee"], name="incidents_organiz_50499b_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="incident",
            constraint=models.UniqueConstraint(
                fields=("organization", "incident_number"),
                name="unique_incident_number_per_organization",
            ),
        ),
    ]
