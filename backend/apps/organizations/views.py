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


class OrganizationListCreateView(APIView):
    """
    List organizations for the authenticated user or create a new organization.
    GET/POST /api/v1/organizations/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        organizations = list_user_organizations(request.user)
        serializer = OrganizationSerializer(organizations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = OrganizationCreateSerializer(
            data=request.data,
            context={'request': request},
        )
        if serializer.is_valid():
            organization = serializer.save()
            return Response(
                OrganizationSerializer(organization).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrganizationDetailView(RetrieveAPIView):
    """
    Retrieve a single organization the authenticated user belongs to.
    GET /api/v1/organizations/<uuid>/
    """

    permission_classes = [IsAuthenticated, IsOrganizationMember]
    serializer_class = OrganizationSerializer

    def get_object(self):
        return self.request.organization


class OrganizationMemberListView(ListAPIView):
    """
    List active members of an organization.
    GET /api/v1/organizations/<uuid>/members/
    """

    permission_classes = [IsAuthenticated, IsOrganizationMember]
    serializer_class = MembershipSerializer
    pagination_class = None

    def get_queryset(self):
        return list_organization_members(self.request.organization)
