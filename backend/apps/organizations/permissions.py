from organizations.context import TenantContext, set_tenant_context
from organizations.selectors import get_organization_by_id, user_has_permission
from organizations.services import OrganizationService
from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied


class IsOrganizationMember(permissions.BasePermission):
    """
    Require an active membership in the organization identified by the URL.

    Cross-tenant access returns 404 to avoid organization enumeration.
    Suspended or removed memberships return 403.
    Sets request.organization, request.membership, and request._tenant_context.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        organization_id = view.kwargs.get("organization_id")
        if not organization_id:
            return False

        organization = get_organization_by_id(organization_id)
        if organization is None:
            raise NotFound("Organization not found.")

        try:
            membership = OrganizationService.validate_organization_access(
                request.user,
                organization,
            )
        except Exception as exc:  # noqa: BLE001
            self._raise_from_validation_error(exc)

        set_tenant_context(
            request,
            TenantContext(
                user=request.user,
                organization=organization,
                membership=membership,
            ),
        )
        return True

    @staticmethod
    def _raise_from_validation_error(exc):
        from rest_framework.exceptions import ValidationError

        if not isinstance(exc, ValidationError):
            raise exc

        code = getattr(exc, "code", None)
        if code == "not_found":
            raise NotFound("Organization not found.") from exc
        raise PermissionDenied(detail=exc.detail) from exc


class RequiresPermission(permissions.BasePermission):
    """
    DRF permission class that requires a specific RBAC codename.

    Usage in a view:
        permission_classes = [IsAuthenticated, IsOrganizationMember, RequiresPermission]
        required_permission = "role.manage"

    IsOrganizationMember must run first (it sets request.organization and
    request.membership).  RequiresPermission reads those values.
    """

    required_permission: str = ""

    def has_permission(self, request, view):
        codename = getattr(view, "required_permission", self.required_permission)
        if not codename:
            return False

        organization = getattr(request, "organization", None)
        if organization is None:
            return False

        return user_has_permission(request.user, organization, codename)


def make_permission_class(codename: str) -> type:
    """
    Factory that creates a RequiresPermission subclass for a given codename.

    Usage:
        permission_classes = [
            IsAuthenticated,
            IsOrganizationMember,
            make_permission_class("role.manage"),
        ]
    """
    return type(
        f"Requires_{codename.replace('.', '_')}",
        (RequiresPermission,),
        {"required_permission": codename},
    )
