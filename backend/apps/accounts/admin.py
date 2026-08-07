from typing import ClassVar

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

User = get_user_model()


class UserAdmin(BaseUserAdmin):
    """
    Custom admin for User model.
    """

    list_display: ClassVar[tuple[str, ...]] = (
        "email",
        "first_name",
        "last_name",
        "is_verified",
        "is_active",
        "created_at",
    )
    list_filter: ClassVar[tuple[str, ...]] = (
        "is_verified",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    search_fields: ClassVar[tuple[str, ...]] = ("email", "first_name", "last_name")
    ordering: ClassVar[tuple[str, ...]] = ("-created_at",)
    fieldsets: ClassVar[tuple[tuple[object, dict[str, object]], ...]] = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_verified",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    readonly_fields: ClassVar[tuple[str, ...]] = (
        "created_at",
        "updated_at",
        "last_login",
    )


admin.site.register(User, UserAdmin)
