"""
SLA API Views — Phase 6

URL hierarchy (all under /api/v1/organizations/<organization_id>/):
  sla-policies/                                  — list / create
  sla-policies/<policy_uuid>/                    — retrieve / update
  sla-policies/<policy_uuid>/targets/            — list / create
  sla-policies/<policy_uuid>/targets/<target_uuid>/ — retrieve / update
"""

from typing import ClassVar

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from organizations.permissions import IsOrganizationMember
from organizations.selectors import user_has_permission
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from sla.models import SLATarget
from sla.selectors import get_sla_policies, get_sla_policy
from sla.serializers import (
    SLAPolicyCreateSerializer,
    SLAPolicySerializer,
    SLAPolicyUpdateSerializer,
    SLATargetCreateSerializer,
    SLATargetSerializer,
    SLATargetUpdateSerializer,
)
from sla.services import SLAPolicyService

_ORG_ID_PARAM = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)
_POLICY_ID_PARAM = OpenApiParameter(
    name="policy_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the SLA policy.",
)
_TARGET_ID_PARAM = OpenApiParameter(
    name="target_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the SLA target.",
)


@extend_schema(tags=["SLA Policies"])
class SLAPolicyListCreateView(APIView):
    """
    List or create SLA policies for an organization.
    GET/POST /api/v1/organizations/<organization_id>/sla-policies/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="List SLA policies",
        description=(
            "Returns all SLA policies scoped to the specified organization. "
            "Requires sla.view permission."
        ),
        parameters=[
            _ORG_ID_PARAM,
            OpenApiParameter(
                name="is_active",
                type=bool,
                location=OpenApiParameter.QUERY,
                description="Filter by active status.",
                required=False,
            ),
        ],
        responses={
            200: SLAPolicySerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        if not user_has_permission(request.user, request.organization, "sla.view"):
            raise PermissionDenied("You do not have permission to view SLA policies.")

        is_active_param = request.query_params.get("is_active")
        is_active = None
        if is_active_param is not None:
            is_active = is_active_param.lower() in ("true", "1")

        policies = get_sla_policies(request.organization, is_active=is_active)
        serializer = SLAPolicySerializer(policies, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create SLA policy",
        description=(
            "Create a new SLA policy for the organization. "
            "Requires sla.manage permission."
        ),
        parameters=[_ORG_ID_PARAM],
        request=SLAPolicyCreateSerializer,
        responses={
            201: SLAPolicySerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def post(self, request, organization_id):
        serializer = SLAPolicyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        policy = SLAPolicyService.create_sla_policy(
            organization=request.organization,
            actor_membership=request.membership,
            name=data["name"],
            description=data.get("description", ""),
            is_active=data.get("is_active", True),
            is_default=data.get("is_default", False),
        )

        output = SLAPolicySerializer(policy)
        return Response(output.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["SLA Policies"])
class SLAPolicyDetailView(APIView):
    """
    Retrieve or update an SLA policy.
    GET/PATCH /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_policy_or_404(self, request, policy_id):
        policy = get_sla_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("SLA policy not found.")
        return policy

    @extend_schema(
        summary="Get SLA policy detail",
        description="Retrieve a single SLA policy including its targets.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        responses={
            200: SLAPolicySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="SLA policy not found."),
        },
    )
    def get(self, request, organization_id, policy_id):
        if not user_has_permission(request.user, request.organization, "sla.view"):
            raise PermissionDenied("You do not have permission to view SLA policies.")
        policy = self._get_policy_or_404(request, policy_id)
        return Response(SLAPolicySerializer(policy).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update SLA policy",
        description=(
            "Update an SLA policy's name, description, active status, or default flag. "
            "Requires sla.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        request=SLAPolicyUpdateSerializer,
        responses={
            200: SLAPolicySerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="SLA policy not found."),
        },
    )
    def patch(self, request, organization_id, policy_id):
        policy = self._get_policy_or_404(request, policy_id)

        serializer = SLAPolicyUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        updated = SLAPolicyService.update_sla_policy(
            policy=policy,
            actor_membership=request.membership,
            name=data.get("name"),
            description=data.get("description"),
            is_active=data.get("is_active"),
            is_default=data.get("is_default"),
        )
        return Response(SLAPolicySerializer(updated).data, status=status.HTTP_200_OK)


@extend_schema(tags=["SLA Targets"])
class SLATargetListCreateView(APIView):
    """
    List or create SLA targets for a policy.
    GET/POST /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_policy_or_404(self, request, policy_id):
        policy = get_sla_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("SLA policy not found.")
        return policy

    @extend_schema(
        summary="List SLA targets",
        description="List all priority-specific SLA targets for a policy.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        responses={
            200: SLATargetSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="SLA policy not found."),
        },
    )
    def get(self, request, organization_id, policy_id):
        if not user_has_permission(request.user, request.organization, "sla.view"):
            raise PermissionDenied("You do not have permission to view SLA policies.")
        policy = self._get_policy_or_404(request, policy_id)
        targets = policy.targets.all().order_by("priority")
        return Response(
            SLATargetSerializer(targets, many=True).data, status=status.HTTP_200_OK
        )

    @extend_schema(
        summary="Create SLA target",
        description=(
            "Create a priority-specific SLA target within a policy. "
            "One target per (policy, priority) pair. Requires sla.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        request=SLATargetCreateSerializer,
        responses={
            201: SLATargetSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="SLA policy not found."),
        },
    )
    def post(self, request, organization_id, policy_id):
        policy = self._get_policy_or_404(request, policy_id)

        serializer = SLATargetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        target = SLAPolicyService.create_sla_target(
            policy=policy,
            actor_membership=request.membership,
            priority=data["priority"],
            response_time_minutes=data["response_time_minutes"],
            resolution_time_minutes=data["resolution_time_minutes"],
        )
        return Response(
            SLATargetSerializer(target).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["SLA Targets"])
class SLATargetDetailView(APIView):
    """
    Retrieve or update a single SLA target.
    GET/PATCH /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/<target_id>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_target_or_404(self, request, policy_id, target_id):
        policy = get_sla_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("SLA policy not found.")
        try:
            return SLATarget.objects.get(id=target_id, policy=policy)
        except (SLATarget.DoesNotExist, ValueError, TypeError):
            raise NotFound("SLA target not found.")

    @extend_schema(
        summary="Get SLA target detail",
        description="Retrieve a single SLA target.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM, _TARGET_ID_PARAM],
        responses={
            200: SLATargetSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="SLA target not found."),
        },
    )
    def get(self, request, organization_id, policy_id, target_id):
        if not user_has_permission(request.user, request.organization, "sla.view"):
            raise PermissionDenied("You do not have permission to view SLA policies.")
        target = self._get_target_or_404(request, policy_id, target_id)
        return Response(SLATargetSerializer(target).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update SLA target",
        description=(
            "Update response and/or resolution time on an SLA target. "
            "Requires sla.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM, _TARGET_ID_PARAM],
        request=SLATargetUpdateSerializer,
        responses={
            200: SLATargetSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="SLA target not found."),
        },
    )
    def patch(self, request, organization_id, policy_id, target_id):
        target = self._get_target_or_404(request, policy_id, target_id)

        serializer = SLATargetUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        updated = SLAPolicyService.update_sla_target(
            target=target,
            actor_membership=request.membership,
            response_time_minutes=data.get("response_time_minutes"),
            resolution_time_minutes=data.get("resolution_time_minutes"),
        )
        return Response(SLATargetSerializer(updated).data, status=status.HTTP_200_OK)
