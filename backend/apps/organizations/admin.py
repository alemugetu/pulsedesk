from django.contrib import admin
from organizations.models import Membership, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['name', 'slug']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['name']


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'status', 'created_at']
    list_filter = ['status', 'organization']
    search_fields = ['user__email', 'organization__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']
