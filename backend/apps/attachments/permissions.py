"""
Permission classes for the Attachments module.

Mirrors the conventions established by comments/permissions.py:
- CanViewIncidentAttachments  — gate on incident.view
- CanUploadAttachment         — gate on incident.view (same as comment creation)
- CanDeleteAttachment         — object-level: uploader OR incident.manage perm
"""

from rest_framework import permissions


class CanViewIncidentAttachments(permissions.BasePermission):
    """
    Require `incident.view` permission to list or download attachments.

    IsOrganizationMember must run first (it sets request.organization).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not hasattr(request, "organization"):
            return False

        from organizations.selectors import user_has_permission

        return user_has_permission(request.user, request.organization, "incident.view")


class CanUploadAttachment(permissions.BasePermission):
    """
    Require `incident.view` permission to upload an attachment.

    Upload access follows incident access (same logic as comment creation).
    IsOrganizationMember must run first.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not hasattr(request, "organization"):
            return False

        from organizations.selectors import user_has_permission

        return user_has_permission(request.user, request.organization, "incident.view")


class CanDeleteAttachment(permissions.BasePermission):
    """
    Object-level permission for attachment deletion.

    Allows deletion when the requesting user:
    - is the uploader of the attachment, OR
    - holds the `incident.manage` permission in the organization.

    View-level check always passes (actual authorization happens in the
    service layer which raises AttachmentValidationError for unauthorized
    attempts, mapped to HTTP 403 by DRF).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if obj.uploader == request.user:
            return True

        if not hasattr(request, "organization"):
            return False

        from organizations.selectors import user_has_permission

        return user_has_permission(
            request.user, request.organization, "incident.manage"
        )
