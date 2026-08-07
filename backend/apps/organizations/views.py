from typing import ClassVar

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from organizations.permissions import IsOrganizationMember
from organizations.selectors import list_organization_members, list_user_organizations
from organizations.serializers import (
    MembershipSerializer,
    OrganizationCreateSerializer,
    OrganizationSerializer,
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
            "user an active membership as the founding member. "
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
        "Returns the details of a single organization. The authenticated user must "
        "have an active membership in the organization. "
        "**Requires authentication and active membership.**"
    ),
    parameters=[_ORG_ID_PARAMETER],
    responses={
        200: OrganizationSerializer,
        401: OpenApiResponse(description="Authentication credentials not provided."),
        403: OpenApiResponse(
            description="Membership is suspended or removed.",
            examples=[
                OpenApiExample(
                    "Suspended",
                    value={
                        "detail": "Your membership in this organization is suspended."
                    },
                )
            ],
        ),
        404: OpenApiResponse(
            description="Organization not found or the user is not a member.",
            examples=[
                OpenApiExample(
                    "Not found",
                    value={"detail": "Organization not found."},
                )
            ],
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


@extend_schema(
    tags=["Memberships"],
    summary="List organization members",
    description=(
        "Returns all active members of the specified organization. "
        "The authenticated user must have an active membership in the organization. "
        "**Requires authentication and active membership.**"
    ),
    parameters=[_ORG_ID_PARAMETER],
    responses={
        200: MembershipSerializer(many=True),
        401: OpenApiResponse(description="Authentication credentials not provided."),
        403: OpenApiResponse(description="Membership is suspended or removed."),
        404: OpenApiResponse(
            description="Organization not found or the user is not a member."
        ),
    },
)
class OrganizationMemberListView(ListAPIView):
    """
    List active members of an organization.
    GET /api/v1/organizations/<uuid>/members/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]
    serializer_class = MembershipSerializer
    pagination_class = None

    def get_queryset(self):
        return list_organization_members(self.request.organization)
