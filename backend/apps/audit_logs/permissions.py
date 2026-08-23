"""
Permission classes for the AuditLog module.

A single new permission codename is introduced: `audit_log.view`.

Access decision:
    Organization Owner        → YES  (all permissions)
    Organization Admin        → YES  (manages the org, needs audit visibility)
    Operations Manager        → YES  (needs operational audit history)
    Agent                     → NO   (audit logs contain sensitive org information)
    Viewer                    → NO   (read-only members do not need audit access)

This decision mirrors the principle that audit logs are an administrative/
operational tool, not an end-user feature.  Agents and Viewers can see
incidents and comments through the normal incident UI but should not have
access to the full org-wide audit trail.

`audit_log.view` is added to INITIAL_PERMISSIONS in organizations/services.py
and granted to Owner, Admin, and Operations Manager roles.
"""

from rest_framework import permissions


class CanViewAuditLogs(permissions.BasePermission):
    """
    Require `audit_log.view` permission to list or retrieve audit log records.

    IsOrganizationMember must run first (it sets request.organization).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not hasattr(request, "organization"):
            return False

        from organizations.selectors import user_has_permission

        return user_has_permission(request.user, request.organization, "audit_log.view")
