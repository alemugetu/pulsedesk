from rest_framework import permissions


class IsCommentAuthorOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow comment authors to edit or delete their comments.

    Read access is allowed for any authenticated organization member.
    Write access (update/delete) is only allowed to the comment author.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated member
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the comment author
        return obj.author == request.user


class CanViewIncidentComments(permissions.BasePermission):
    """
    Permission to view comments on an incident.

    Requires the user to be an authenticated member of the organization
    and have incident.view permission.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Check if user has organization context set by IsOrganizationMember
        if not hasattr(request, "organization"):
            return False

        # Check incident.view permission
        from organizations.selectors import user_has_permission

        return user_has_permission(request.user, request.organization, "incident.view")


class CanCreateComment(permissions.BasePermission):
    """
    Permission to create comments on an incident.

    Requires the user to be an authenticated member of the organization
    and have incident.view permission (comment creation is generally allowed
    for anyone who can view the incident).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Check if user has organization context set by IsOrganizationMember
        if not hasattr(request, "organization"):
            return False

        # Check incident.view permission (comment creation follows incident access)
        from organizations.selectors import user_has_permission

        return user_has_permission(request.user, request.organization, "incident.view")
