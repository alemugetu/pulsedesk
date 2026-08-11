from typing import ClassVar

from django.contrib import admin
from organizations.models import (
    Membership,
    Organization,
    Permission,
    Role,
    RolePermission,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display: ClassVar = ["name", "slug", "status", "created_at"]
    list_filter: ClassVar = ["status"]
    search_fields: ClassVar = ["name", "slug"]
    readonly_fields: ClassVar = ["id", "created_at", "updated_at"]
    ordering: ClassVar = ["name"]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display: ClassVar = ["codename", "name", "resource", "action"]
    list_filter: ClassVar = ["resource"]
    search_fields: ClassVar = ["codename", "name"]
    readonly_fields: ClassVar = ["id", "created_at", "updated_at"]
    ordering: ClassVar = ["resource", "action"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display: ClassVar = ["name", "organization", "is_system_role", "created_at"]
    list_filter: ClassVar = ["is_system_role", "organization"]
    search_fields: ClassVar = ["name", "slug", "organization__name"]
    readonly_fields: ClassVar = ["id", "slug", "created_at", "updated_at"]
    ordering: ClassVar = ["organization", "name"]


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display: ClassVar = ["role", "permission"]
    readonly_fields: ClassVar = ["id", "created_at", "updated_at"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display: ClassVar = ["user", "organization", "role", "status", "created_at"]
    list_filter: ClassVar = ["status", "organization"]
    search_fields: ClassVar = ["user__email", "organization__name", "role__name"]
    readonly_fields: ClassVar = ["id", "created_at", "updated_at"]
    ordering: ClassVar = ["-created_at"]
