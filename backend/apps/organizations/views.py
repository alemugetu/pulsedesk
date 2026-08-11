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
    MembershipRoleAssignSerializer,
    MembershipSerializer,
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
        summary="List organizations",
        description=(
            "Returns all active organizations where the authenticated user has an "
            "active membership. **Requires authentication.**"
        ),
        responses={
            200: OrganizationSerializer(many=True),
            401: OpenApiResponse(
                description="Authentication credentials not provided."
            ),
        },
    )
    def get(self, request):
        organizations = list_user_organizations(request.user)
        serializer = OrganizationSerializer(organizations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create organization",
        description=(
            "Creates a new organization and automatically grants the authenticated "
            "user an active membership as the founding owner. "
            "**Requires authentication.**"
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
                ],
            ),
            401: OpenApiResponse(
                description="Authentication credentials not provided."
            ),
        },
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
        "Returns the details of a single organization. "
        "**Requires authentication and active membership.**"
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
        "Returns all active members of the specified organization. "
        "**Requires authentication, active membership, and member.view permission.**"
    ),
    parameters=[_ORG_ID_PARAMETER],
    responses={
        200: MembershipSerializer(many=True),
        401: OpenApiResponse(description="Authentication credentials not provided."),
        403: OpenApiResponse(
            description="Membership suspended/removed or missing permission."
        ),
        404: OpenApiResponse(
            description="Organization not found or user is not a member."
        ),
    },
)
class OrganizationMemberListView(ListAPIView):
    """
    List active members of an organization.
    GET /api/v1/organizations/<uuid>/members/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        make_permission_class("member.view"),
    ]
    serializer_class = MembershipSerializer
    pagination_class = None

    def get_queryset(self):
        return list_organization_members(self.request.organization)


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
            "Returns all roles in the organization. "
            "**Requires role.view permission.**"
        ),
        responses={
            200: RoleSerializer(many=True),
            401: OpenApiResponse(description="Not authenticated."),
            403: OpenApiResponse(
                description="Missing permission or inactive membership."
            ),
            404: OpenApiResponse(description="Organization not found."),
        },
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
            "Creates a new custom role in the organization. "
            "**Requires role.manage permission.**"
        ),
        request=RoleCreateSerializer,
        responses={
            201: RoleSerializer,
            400: OpenApiResponse(description="Validation error."),
            403: OpenApiResponse(description="Missing permission."),
            404: OpenApiResponse(description="Organization not found."),
        },
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
    GET   /api/v1/organizations/<uuid>/roles/<role_uuid>/
    PATCH /api/v1/organizations/<uuid>/roles/<role_uuid>/
    DELETE /api/v1/organizations/<uuid>/roles/<role_uuid>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_role_or_404(self, request, role_id):
        role = get_role_by_id(role_id, request.organization)
        if role is None:
            return None
        return role

    @extend_schema(
        summary="Retrieve role",
        description="Returns a single role. **Requires role.view permission.**",
        responses={
            200: RoleSerializer,
            403: OpenApiResponse(description="Missing permission."),
            404: OpenApiResponse(description="Role not found."),
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
            "Partially updates a custom role's name, description, or permissions. "
            "System roles cannot be modified. **Requires role.manage permission.**"
        ),
        request=RoleUpdateSerializer,
        responses={
            200: RoleSerializer,
            400: OpenApiResponse(description="Validation error."),
            403: OpenApiResponse(description="Missing permission or system role."),
            404: OpenApiResponse(description="Role not found."),
        },
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
            "Deletes a custom role. System roles cannot be deleted. "
            "**Requires role.manage permission.**"
        ),
        responses={
            204: OpenApiResponse(description="Role deleted."),
            403: OpenApiResponse(description="Missing permission or system role."),
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
    summary="Assign role to membership",
    description=(
        "Assigns (or removes) a role from an organization member. "
        "The role must belong to the same organization. "
        "**Requires role.assign permission. "
        "Only the owner can assign the owner role.**"
    ),
    parameters=[_ORG_ID_PARAMETER, _MEMBERSHIP_ID_PARAMETER],
    request=MembershipRoleAssignSerializer,
    responses={
        200: MembershipSerializer,
        400: OpenApiResponse(description="Validation error or cross-tenant role."),
        403: OpenApiResponse(
            description="Missing permission or privilege escalation attempt."
        ),
        404: OpenApiResponse(description="Membership not found."),
    },
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
