import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [  # noqa: RUF012
        ("organizations", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [  # noqa: RUF012
        migrations.CreateModel(
            name="RolePermission",
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
            ],
            options={
                "verbose_name": "Role Permission",
                "verbose_name_plural": "Role Permissions",
                "db_table": "rbac_role_permissions",
            },
        ),
        migrations.CreateModel(
            name="Permission",
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
                ("codename", models.CharField(max_length=100, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("resource", models.CharField(max_length=100)),
                ("action", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="")),
            ],
            options={
                "verbose_name": "Permission",
                "verbose_name_plural": "Permissions",
                "db_table": "rbac_permissions",
                "ordering": ["resource", "action"],
                "indexes": [
                    models.Index(
                        fields=["codename"], name="rbac_permis_codenam_64fe17_idx"
                    ),
                    models.Index(
                        fields=["resource"], name="rbac_permis_resourc_5ea9ca_idx"
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="Role",
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
                (
                    "is_system_role",
                    models.BooleanField(
                        default=False,
                        help_text="System roles are seeded automatically and cannot be deleted.",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="roles",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "Role",
                "verbose_name_plural": "Roles",
                "db_table": "rbac_roles",
            },
        ),
        migrations.AddField(
            model_name="membership",
            name="role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="memberships",
                to="organizations.role",
            ),
        ),
        migrations.AddIndex(
            model_name="membership",
            index=models.Index(
                fields=["organization", "role"], name="organizatio_organiz_427ab0_idx"
            ),
        ),
        migrations.AddField(
            model_name="rolepermission",
            name="permission",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="role_permissions",
                to="organizations.permission",
            ),
        ),
        migrations.AddField(
            model_name="rolepermission",
            name="role",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="role_permissions",
                to="organizations.role",
            ),
        ),
        migrations.AddField(
            model_name="role",
            name="permissions",
            field=models.ManyToManyField(
                blank=True,
                related_name="roles",
                through="organizations.RolePermission",
                to="organizations.permission",
            ),
        ),
        migrations.AddConstraint(
            model_name="rolepermission",
            constraint=models.UniqueConstraint(
                fields=("role", "permission"), name="unique_role_permission"
            ),
        ),
        migrations.AddIndex(
            model_name="role",
            index=models.Index(
                fields=["organization", "slug"], name="rbac_roles_organiz_418a4c_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="role",
            index=models.Index(
                fields=["organization", "is_system_role"],
                name="rbac_roles_organiz_d7a7f0_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=("organization", "slug"),
                name="unique_role_slug_per_organization",
            ),
        ),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=("organization", "name"),
                name="unique_role_name_per_organization",
            ),
        ),
    ]
