from typing import ClassVar

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from organizations.permissions import (
    IsOrganizationMember,
    make_permission_class,
)
from organizations.selectors import (
    get_membership_by_id,
    get_organization_roles,
    get_role_by_id,
    list_organization_members,
    list_user_organizations,
)
from organizations.serializers import (
    MembershipCreateSerializer,
    MembershipRoleAssignSerializer,
    MembershipSerializer,
    MembershipStatusUpdateSerializer,
    OrganizationCreateSerializer,
    OrganizationSerializer,
    RoleCreateSerializer,
    RoleSerializer,
    RoleUpdateSerializer,
)
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

_ORG_ID_PARAMETER = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)
_ROLE_ID_PARAMETER = OpenApiParameter(
    name="role_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the role.",
)
_MEMBERSHIP_ID_PARAMETER = OpenApiParameter(
    name="membership_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the membership.",
)

# ---------------------------------------------------------------------------
# Shared documentation constants
# ---------------------------------------------------------------------------

_ROLE_MATRIX_MD = """
## Role & Permission Matrix

Every organization is automatically seeded with 5 system roles when it is
created. System roles cannot be deleted or renamed.

| Role | Permissions |
|---|---|
| **Organization Owner** | All permissions. Full control. Only one owner per org unless explicitly transferred. |
| **Organization Admin** | `organization.view`, `organization.update`, `member.view`, `member.invite`, `member.remove`, `member.suspend`, `role.view`, `role.manage`, `role.assign` |
| **Operations Manager** | `organization.view`, `member.view`, `member.invite`, `member.remove`, `member.suspend`, `role.view`, `role.assign` |
| **Agent** | `organization.view`, `member.view`, `role.view` |
| **Viewer** | `organization.view`, `member.view`, `role.view` |

Custom roles can be created with any subset of the permissions above.
"""

_HOW_TO_GET_OWNER_MD = """
## How to become Organization Owner

**The creator of an organization is automatically assigned the
Organization Owner role.** No manual step required.

**Quick-start workflow:**

1. `POST /api/v1/auth/register/` — create your account.
2. Click **Authorize** in Swagger and enter your access token.
3. `POST /api/v1/organizations/` with `{"name": "My Company"}`.
4. You are now the owner. Your membership already has the Owner role.
5. `GET /api/v1/organizations/{id}/members/` — confirm your role is
   `organization-owner`.
6. `GET /api/v1/organizations/{id}/roles/` — view all 5 system roles
   and their permission sets.
"""

_OWNERSHIP_TRANSFER_MD = """
## Ownership transfer rules

- Only the current owner can assign the `organization-owner` role to
  another member.
- An owner cannot remove their own owner role if they are the **sole**
  owner (returns 403 `sole_owner_protected`).
- To transfer: assign `organization-owner` to another member first,
  then optionally downgrade yourself.
"""


# ---------------------------------------------------------------------------
# Organization views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Organizations"])
class OrganizationListCreateView(APIView):
    """
    List organizations for the authenticated user or create a new organization.
    GET/POST /api/v1/organizations/
    """

    permission_classes: ClassVar = [IsAuthenticated]

    @extend_schema(
        summary="List my organizations",
        description=(
            "Returns all active organizations where the authenticated user has an "
            "active membership.\n\n"
            "**Requires authentication.**\n\n" + _HOW_TO_GET_OWNER_MD
        ),
        responses={
            200: OrganizationSerializer(many=True),
            401: OpenApiResponse(
                description="Authentication credentials not provided."
            ),
        },
        examples=[
            OpenApiExample(
                "Organization list",
                value=[
                    {
                        "id": "018f1a2b-0001-7000-0000-000000000001",
                        "name": "Acme Corp",
                        "slug": "acme-corp",
                        "status": "ACTIVE",
                        "created_at": "2026-01-01T09:00:00Z",
                        "updated_at": "2026-01-01T09:00:00Z",
                    }
                ],
                response_only=True,
            )
        ],
    )
    def get(self, request):
        organizations = list_user_organizations(request.user)
        serializer = OrganizationSerializer(organizations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create organization (caller becomes Owner)",
        description=(
            "Creates a new organization. The authenticated user is **automatically "
            "assigned the Organization Owner role** — no extra step needed.\n\n"
            "Five system roles are seeded for the organization at creation time:\n"
            "- Organization Owner\n"
            "- Organization Admin\n"
            "- Operations Manager\n"
            "- Agent\n"
            "- Viewer\n\n"
            "**Requires authentication.**\n\n" + _ROLE_MATRIX_MD
        ),
        request=OrganizationCreateSerializer,
        responses={
            201: OrganizationSerializer,
            400: OpenApiResponse(
                description="Validation error — missing name or invalid slug.",
                examples=[
                    OpenApiExample(
                        "Name required",
                        value={"name": ["Organization name is required."]},
                    ),
                    OpenApiExample(
                        "Invalid slug",
                        value={"slug": ["Enter a valid slug."]},
                    ),
                ],
            ),
            401: OpenApiResponse(
                description="Authentication credentials not provided."
            ),
        },
        examples=[
            OpenApiExample(
                "Create request",
                value={"name": "Acme Corp"},
                request_only=True,
            ),
            OpenApiExample(
                "Create with custom slug",
                value={"name": "Acme Corp", "slug": "acme"},
                request_only=True,
            ),
            OpenApiExample(
                "Created organization",
                value={
                    "id": "018f1a2b-0001-7000-0000-000000000001",
                    "name": "Acme Corp",
                    "slug": "acme-corp",
                    "status": "ACTIVE",
                    "created_at": "2026-01-01T09:00:00Z",
                    "updated_at": "2026-01-01T09:00:00Z",
                },
                response_only=True,
            ),
        ],
    )
    def post(self, request):
        serializer = OrganizationCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        if serializer.is_valid():
            organization = serializer.save()
            return Response(
                OrganizationSerializer(organization).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Organizations"],
    summary="Retrieve organization",
    description=(
        "Returns the details of a single organization.\n\n"
        "**Requires authentication and active membership.**\n\n"
        "Returns 404 for organizations the user does not belong to "
        "(to prevent organization enumeration)."
    ),
    parameters=[_ORG_ID_PARAMETER],
    responses={
        200: OrganizationSerializer,
        401: OpenApiResponse(description="Authentication credentials not provided."),
        403: OpenApiResponse(description="Membership is suspended or removed."),
        404: OpenApiResponse(
            description="Organization not found or user is not a member."
        ),
    },
)
class OrganizationDetailView(RetrieveAPIView):
    """
    Retrieve a single organization the authenticated user belongs to.
    GET /api/v1/organizations/<uuid>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]
    serializer_class = OrganizationSerializer

    def get_object(self):
        return self.request.organization


# ---------------------------------------------------------------------------
# Member views
# ---------------------------------------------------------------------------


@extend_schema(
    tags=["Memberships"],
    summary="List organization members",
    description=(
        "Returns all active members of the specified organization, including each "
        "member's assigned role and permissions.\n\n"
        "**Required permission: `member.view`**\n\n"
        "All roles except Viewer and Agent have this permission by default.\n\n"
        "The response includes a `role` object on each membership showing the "
        "role name and its full permission list."
    ),
    parameters=[_ORG_ID_PARAMETER],
    responses={
        200: MembershipSerializer(many=True),
        401: OpenApiResponse(description="Authentication credentials not provided."),
        403: OpenApiResponse(
            description=(
                "Membership suspended/removed, no role assigned, "
                "or missing `member.view` permission."
            )
        ),
        404: OpenApiResponse(
            description="Organization not found or user is not a member."
        ),
    },
    examples=[
        OpenApiExample(
            "Member list with roles",
            value=[
                {
                    "id": "018f1a2b-0002-7000-0000-000000000001",
                    "user": {
                        "id": "018f1a2b-0000-7000-0000-000000000001",
                        "email": "alice@example.com",
                        "first_name": "Alice",
                        "last_name": "Smith",
                    },
                    "role": {
                        "id": "018f1a2b-0003-7000-0000-000000000001",
                        "name": "Organization Owner",
                        "slug": "organization-owner",
                        "description": "Full control over the organization.",
                        "is_system_role": True,
                        "permissions": [
                            "member.invite",
                            "member.remove",
                            "member.suspend",
                            "member.view",
                            "organization.update",
                            "organization.view",
                            "role.assign",
                            "role.manage",
                            "role.view",
                        ],
                        "created_at": "2026-01-01T09:00:00Z",
                        "updated_at": "2026-01-01T09:00:00Z",
                    },
                    "status": "ACTIVE",
                    "created_at": "2026-01-01T09:00:00Z",
                    "updated_at": "2026-01-01T09:00:00Z",
                }
            ],
            response_only=True,
        )
    ],
)
class OrganizationMemberListView(APIView):
    """
    List active members or create/invite a new member.
    GET  /api/v1/organizations/<uuid>/members/
    POST /api/v1/organizations/<uuid>/members/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
    ]

    def get(self, request, organization_id):
        from organizations.selectors import user_has_permission

        if not user_has_permission(request.user, request.organization, "member.view"):
            return Response(
                {"detail": "You do not have permission to view members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        members = list_organization_members(request.organization)
        serializer = MembershipSerializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, organization_id):
        serializer = MembershipCreateSerializer(
            data=request.data,
            context={
                "organization": request.organization,
                "actor_membership": request.membership,
            },
        )
        if serializer.is_valid():
            try:
                membership = serializer.save()
            except Exception as exc:
                from rest_framework.exceptions import ValidationError

                if isinstance(exc, ValidationError):
                    code = getattr(exc, "code", None)
                    http_status = (
                        status.HTTP_403_FORBIDDEN
                        if code in {"permission_denied", "owner_escalation"}
                        else status.HTTP_400_BAD_REQUEST
                    )
                    return Response(exc.detail, status=http_status)
                raise
            return Response(
                MembershipSerializer(membership).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Memberships"],
    parameters=[_ORG_ID_PARAMETER, _MEMBERSHIP_ID_PARAMETER],
)
class MembershipDetailView(APIView):
    """
    GET    /api/v1/organizations/<uuid>/members/<membership_uuid>/
    PATCH  /api/v1/organizations/<uuid>/members/<membership_uuid>/
    DELETE /api/v1/organizations/<uuid>/members/<membership_uuid>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_membership_or_404(self, request, membership_id):
        return get_membership_by_id(membership_id, request.organization)

    def get(self, request, organization_id, membership_id):
        from organizations.selectors import user_has_permission

        if not user_has_permission(request.user, request.organization, "member.view"):
            return Response(
                {"detail": "You do not have permission to view members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        membership = self._get_membership_or_404(request, membership_id)
        if membership is None:
            return Response(
                {"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(MembershipSerializer(membership).data)

    def patch(self, request, organization_id, membership_id):
        membership = self._get_membership_or_404(request, membership_id)
        if membership is None:
            return Response(
                {"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = MembershipStatusUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
            context={"actor_membership": request.membership},
        )
        if serializer.is_valid():
            try:
                updated = serializer.save()
            except Exception as exc:
                from rest_framework.exceptions import ValidationError

                if isinstance(exc, ValidationError):
                    code = getattr(exc, "code", None)
                    http_status = (
                        status.HTTP_403_FORBIDDEN
                        if code in {"permission_denied", "sole_owner_protected"}
                        else status.HTTP_400_BAD_REQUEST
                    )
                    return Response(exc.detail, status=http_status)
                raise
            return Response(MembershipSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, organization_id, membership_id):
        membership = self._get_membership_or_404(request, membership_id)
        if membership is None:
            return Response(
                {"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            from organizations.services import OrganizationService

            OrganizationService.remove_member(
                membership=membership,
                actor_membership=request.membership,
            )
        except Exception as exc:
            from rest_framework.exceptions import ValidationError

            if isinstance(exc, ValidationError):
                code = getattr(exc, "code", None)
                http_status = (
                    status.HTTP_403_FORBIDDEN
                    if code in {"permission_denied", "sole_owner_protected"}
                    else status.HTTP_400_BAD_REQUEST
                )
                return Response(exc.detail, status=http_status)
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Role views
# ---------------------------------------------------------------------------


@extend_schema(
    tags=["Roles"],
    parameters=[_ORG_ID_PARAMETER],
)
class RoleListCreateView(APIView):
    """
    GET  /api/v1/organizations/<uuid>/roles/
    POST /api/v1/organizations/<uuid>/roles/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="List roles",
        description=(
            "Returns all roles in the organization — both system roles (seeded "
            "automatically) and any custom roles created by admins.\n\n"
            "Each role includes its full permission list.\n\n"
            "**Required permission: `role.view`**\n\n" + _ROLE_MATRIX_MD
        ),
        responses={
            200: RoleSerializer(many=True),
            401: OpenApiResponse(description="Not authenticated."),
            403: OpenApiResponse(
                description="Missing `role.view` permission or inactive membership."
            ),
            404: OpenApiResponse(description="Organization not found."),
        },
        examples=[
            OpenApiExample(
                "System roles response",
                value=[
                    {
                        "id": "018f0001-0000-7000-0000-000000000001",
                        "name": "Organization Owner",
                        "slug": "organization-owner",
                        "description": "Full control over the organization.",
                        "is_system_role": True,
                        "permissions": [
                            "member.invite",
                            "member.remove",
                            "member.suspend",
                            "member.view",
                            "organization.update",
                            "organization.view",
                            "role.assign",
                            "role.manage",
                            "role.view",
                        ],
                        "created_at": "2026-01-01T09:00:00Z",
                        "updated_at": "2026-01-01T09:00:00Z",
                    },
                    {
                        "id": "018f0001-0000-7000-0000-000000000005",
                        "name": "Viewer",
                        "slug": "viewer",
                        "description": "Read-only access to organization, members, and roles.",
                        "is_system_role": True,
                        "permissions": [
                            "member.view",
                            "organization.view",
                            "role.view",
                        ],
                        "created_at": "2026-01-01T09:00:00Z",
                        "updated_at": "2026-01-01T09:00:00Z",
                    },
                ],
                response_only=True,
            )
        ],
    )
    def get(self, request, organization_id):
        from organizations.selectors import user_has_permission

        if not user_has_permission(request.user, request.organization, "role.view"):
            return Response(
                {"detail": "You do not have permission to view roles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        roles = get_organization_roles(request.organization)
        return Response(RoleSerializer(roles, many=True).data)

    @extend_schema(
        summary="Create custom role",
        description=(
            "Creates a new custom role in the organization with a chosen "
            "set of permissions.\n\n"
            "**Required permission: `role.manage`** (Owner and Admin only)\n\n"
            "Rules:\n"
            "- Role name must be unique within the organization.\n"
            "- Permissions must be valid codenames from the permission list.\n"
            "- Custom roles have `is_system_role: false` and can be deleted.\n"
            "- System roles (`is_system_role: true`) are created automatically "
            "and cannot be modified via this endpoint.\n\n"
            "**Available permission codenames:**\n"
            "`organization.view`, `organization.update`, `member.view`, "
            "`member.invite`, `member.remove`, `member.suspend`, "
            "`role.view`, `role.manage`, `role.assign`"
        ),
        request=RoleCreateSerializer,
        responses={
            201: RoleSerializer,
            400: OpenApiResponse(
                description="Validation error — duplicate name or unknown permissions.",
                examples=[
                    OpenApiExample(
                        "Duplicate role name",
                        value={
                            "name": [
                                "A role with this name already exists in this organization."
                            ]
                        },
                    ),
                    OpenApiExample(
                        "Unknown permission",
                        value={
                            "permissions": ["Unknown permissions: ['incidents.view']"]
                        },
                    ),
                ],
            ),
            403: OpenApiResponse(description="Missing `role.manage` permission."),
            404: OpenApiResponse(description="Organization not found."),
        },
        examples=[
            OpenApiExample(
                "Create role request",
                value={
                    "name": "Support Lead",
                    "description": "Handles member onboarding and role assignment.",
                    "permissions": [
                        "member.view",
                        "member.invite",
                        "role.view",
                        "role.assign",
                    ],
                },
                request_only=True,
            ),
            OpenApiExample(
                "Created role response",
                value={
                    "id": "018f0099-0000-7000-0000-000000000001",
                    "name": "Support Lead",
                    "slug": "support-lead",
                    "description": "Handles member onboarding and role assignment.",
                    "is_system_role": False,
                    "permissions": [
                        "member.invite",
                        "member.view",
                        "role.assign",
                        "role.view",
                    ],
                    "created_at": "2026-01-01T10:00:00Z",
                    "updated_at": "2026-01-01T10:00:00Z",
                },
                response_only=True,
            ),
        ],
    )
    def post(self, request, organization_id):
        serializer = RoleCreateSerializer(
            data=request.data,
            context={
                "organization": request.organization,
                "actor_membership": request.membership,
            },
        )
        if serializer.is_valid():
            try:
                role = serializer.save()
            except Exception as exc:
                from rest_framework.exceptions import ValidationError

                if isinstance(exc, ValidationError):
                    return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
                raise
            return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Roles"],
    parameters=[_ORG_ID_PARAMETER, _ROLE_ID_PARAMETER],
)
class RoleDetailView(APIView):
    """
    GET    /api/v1/organizations/<uuid>/roles/<role_uuid>/
    PATCH  /api/v1/organizations/<uuid>/roles/<role_uuid>/
    DELETE /api/v1/organizations/<uuid>/roles/<role_uuid>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_role_or_404(self, request, role_id):
        return get_role_by_id(role_id, request.organization)

    @extend_schema(
        summary="Retrieve role",
        description=(
            "Returns a single role with its full permission list.\n\n"
            "**Required permission: `role.view`**"
        ),
        responses={
            200: RoleSerializer,
            403: OpenApiResponse(description="Missing `role.view` permission."),
            404: OpenApiResponse(description="Role not found in this organization."),
        },
    )
    def get(self, request, organization_id, role_id):
        from organizations.selectors import user_has_permission

        if not user_has_permission(request.user, request.organization, "role.view"):
            return Response(
                {"detail": "You do not have permission to view roles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        role = self._get_role_or_404(request, role_id)
        if role is None:
            return Response(
                {"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(RoleSerializer(role).data)

    @extend_schema(
        summary="Update custom role",
        description=(
            "Partially updates a custom role's name, description, or permission set.\n\n"
            "**Required permission: `role.manage`** (Owner and Admin only)\n\n"
            "Restrictions:\n"
            "- System roles (`is_system_role: true`) **cannot** be modified. "
            "Returns 400 `system_role_protected`.\n"
            "- `permissions` field replaces the entire permission set when provided. "
            "Omit it to leave permissions unchanged.\n"
            "- Role name must remain unique within the organization."
        ),
        request=RoleUpdateSerializer,
        responses={
            200: RoleSerializer,
            400: OpenApiResponse(
                description="Validation error or attempt to modify a system role.",
                examples=[
                    OpenApiExample(
                        "System role protected",
                        value={"detail": "System roles cannot be modified."},
                    ),
                ],
            ),
            403: OpenApiResponse(description="Missing `role.manage` permission."),
            404: OpenApiResponse(description="Role not found."),
        },
        examples=[
            OpenApiExample(
                "Update name only",
                value={"name": "Support Manager"},
                request_only=True,
            ),
            OpenApiExample(
                "Replace permissions",
                value={"permissions": ["member.view", "role.view"]},
                request_only=True,
            ),
        ],
    )
    def patch(self, request, organization_id, role_id):
        role = self._get_role_or_404(request, role_id)
        if role is None:
            return Response(
                {"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = RoleUpdateSerializer(
            role,
            data=request.data,
            partial=True,
            context={"actor_membership": request.membership},
        )
        if serializer.is_valid():
            try:
                updated_role = serializer.save()
            except Exception as exc:
                from rest_framework.exceptions import ValidationError

                if isinstance(exc, ValidationError):
                    return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
                raise
            return Response(RoleSerializer(updated_role).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Delete custom role",
        description=(
            "Permanently deletes a custom role.\n\n"
            "**Required permission: `role.manage`** (Owner and Admin only)\n\n"
            "Restrictions:\n"
            "- System roles (`is_system_role: true`) **cannot** be deleted. "
            "Returns 403 `system_role_protected`.\n"
            "- Memberships that held this role will have their role set to `null` "
            "(Django `SET_NULL` behavior)."
        ),
        responses={
            204: OpenApiResponse(description="Role deleted successfully."),
            403: OpenApiResponse(
                description="Missing permission or attempt to delete a system role.",
                examples=[
                    OpenApiExample(
                        "System role protected",
                        value={"detail": "System roles cannot be deleted."},
                    ),
                ],
            ),
            404: OpenApiResponse(description="Role not found."),
        },
    )
    def delete(self, request, organization_id, role_id):
        role = self._get_role_or_404(request, role_id)
        if role is None:
            return Response(
                {"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            from organizations.services import RBACService

            RBACService.delete_role(role=role, actor_membership=request.membership)
        except Exception as exc:
            from rest_framework.exceptions import ValidationError

            if isinstance(exc, ValidationError):
                return Response(exc.detail, status=status.HTTP_403_FORBIDDEN)
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Membership role assignment view
# ---------------------------------------------------------------------------


@extend_schema(
    tags=["Memberships"],
    summary="Assign (or remove) role on a membership",
    description=(
        "Assigns a role to an organization member, or removes their role by "
        "sending `null`.\n\n"
        "**Required permission: `role.assign`**\n\n"
        "Security rules enforced:\n"
        "- The role must belong to **this** organization. Cross-tenant roles are "
        "rejected (400 `cross_tenant_role`).\n"
        "- Only the current **Organization Owner** can assign the owner role to "
        "someone else (403 `owner_escalation` otherwise).\n"
        "- The **sole owner** cannot remove their own owner role without first "
        "transferring ownership (403 `sole_owner_protected`).\n\n"
        + _OWNERSHIP_TRANSFER_MD
        + "\n\n**How to transfer ownership:**\n"
        "1. Find the target member's `membership_id` via "
        "`GET /api/v1/organizations/{id}/members/`.\n"
        "2. Find the owner role `id` via "
        "`GET /api/v1/organizations/{id}/roles/` (slug: `organization-owner`).\n"
        "3. `PATCH` this endpoint with the target membership and owner role id.\n"
        "4. Optionally downgrade yourself to Admin or another role."
    ),
    parameters=[_ORG_ID_PARAMETER, _MEMBERSHIP_ID_PARAMETER],
    request=MembershipRoleAssignSerializer,
    responses={
        200: MembershipSerializer,
        400: OpenApiResponse(
            description="Validation error or cross-tenant role.",
            examples=[
                OpenApiExample(
                    "Role not in this org",
                    value={"role_id": ["Role not found in this organization."]},
                ),
            ],
        ),
        403: OpenApiResponse(
            description="Missing permission or ownership protection triggered.",
            examples=[
                OpenApiExample(
                    "No permission",
                    value={"detail": "You do not have permission to assign roles."},
                ),
                OpenApiExample(
                    "Owner escalation blocked",
                    value={
                        "detail": "Only the organization owner can assign the owner role."
                    },
                ),
                OpenApiExample(
                    "Sole owner protected",
                    value={
                        "detail": (
                            "Cannot remove the sole owner. "
                            "Transfer ownership before changing this role."
                        )
                    },
                ),
            ],
        ),
        404: OpenApiResponse(description="Membership not found in this organization."),
    },
    examples=[
        OpenApiExample(
            "Assign a role",
            value={"role_id": "018f0001-0000-7000-0000-000000000005"},
            request_only=True,
        ),
        OpenApiExample(
            "Remove role (set to null)",
            value={"role_id": None},
            request_only=True,
        ),
    ],
)
class MembershipRoleAssignView(APIView):
    """
    PATCH /api/v1/organizations/<uuid>/members/<membership_uuid>/role/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def patch(self, request, organization_id, membership_id):
        membership = get_membership_by_id(membership_id, request.organization)
        if membership is None:
            return Response(
                {"detail": "Membership not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MembershipRoleAssignSerializer(
            data=request.data,
            context={
                "organization": request.organization,
                "membership": membership,
                "actor_membership": request.membership,
            },
        )
        if serializer.is_valid():
            try:
                updated = serializer.save()
            except Exception as exc:
                from rest_framework.exceptions import ValidationError

                if isinstance(exc, ValidationError):
                    code = getattr(exc, "code", None)
                    http_status = (
                        status.HTTP_403_FORBIDDEN
                        if code
                        in {
                            "permission_denied",
                            "owner_escalation",
                            "sole_owner_protected",
                        }
                        else status.HTTP_400_BAD_REQUEST
                    )
                    return Response(exc.detail, status=http_status)
                raise
            return Response(MembershipSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
