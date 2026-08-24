from typing import ClassVar

from django.contrib import admin
from settings.models import OrganizationSettings


@admin.register(OrganizationSettings)
class OrganizationSettingsAdmin(admin.ModelAdmin):
    list_display: ClassVar = [
        "organization",
        "default_incident_priority",
        "default_incident_status",
        "incident_comments_enabled",
        "sla_auto_apply_default_policy",
        "escalation_auto_apply_default_policy",
        "created_at",
        "updated_at",
    ]
    list_filter: ClassVar = [
        "default_incident_priority",
        "default_incident_status",
        "incident_comments_enabled",
        "sla_auto_apply_default_policy",
        "escalation_auto_apply_default_policy",
        "notification_incident_emails_enabled",
        "notification_escalation_emails_enabled",
        "notification_sla_emails_enabled",
    ]
    search_fields: ClassVar = ["organization__name", "organization__slug"]
    ordering: ClassVar = ["organization__name"]
    raw_id_fields: ClassVar = ["organization"]

    fieldsets = (
        (
            "Organization",
            {"fields": ("organization",)},
        ),
        (
            "Incident Settings",
            {
                "fields": (
                    "default_incident_priority",
                    "default_incident_status",
                    "incident_comments_enabled",
                ),
            },
        ),
        (
            "Notification Preferences",
            {
                "fields": (
                    "notification_incident_emails_enabled",
                    "notification_escalation_emails_enabled",
                    "notification_sla_emails_enabled",
                ),
                "description": (
                    "Organization-level email toggles. "
                    "In-app notifications are always delivered for critical "
                    "operational events."
                ),
            },
        ),
        (
            "SLA Defaults",
            {"fields": ("sla_auto_apply_default_policy",)},
        ),
        (
            "Escalation Defaults",
            {"fields": ("escalation_auto_apply_default_policy",)},
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    def get_readonly_fields(self, request, obj=None):
        readonly = ["created_at", "updated_at"]
        if obj is not None:
            readonly.append("organization")
        return readonly
