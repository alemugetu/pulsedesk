"""
Escalation API Views — Phase 7

URL hierarchy (all under /api/v1/organizations/<organization_id>/):

  escalation-policies/                                        — list / create
  escalation-policies/<policy_uuid>/                          — retrieve / update
  escalation-policies/<policy_uuid>/levels/                   — list / create
  escalation-policies/<policy_uuid>/levels/<level_uuid>/      — retrieve / update
  escalation-policies/<policy_uuid>/rules/                    — list / create

  incidents/<incident_uuid>/escalations/                      — read-only history
  incidents/<incident_uuid>/escalations/evaluate/             — manual evaluation
"""

from typing import ClassVar

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from escalation.selectors import (
    get_escalation_level,
    get_escalation_levels,
    get_escalation_policies,
    get_escalation_policy,
    get_escalation_rules,
    get_incident_escalations,
)
from escalation.serializers import (
    EscalationEvaluateSerializer,
    EscalationLevelCreateSerializer,
    EscalationLevelSerializer,
    EscalationLevelUpdateSerializer,
    EscalationPolicyCreateSerializer,
    EscalationPolicySerializer,
    EscalationPolicyUpdateSerializer,
    EscalationRuleCreateSerializer,
    EscalationRuleSerializer,
    IncidentEscalationSerializer,
)
from escalation.services import (
    EscalationEvaluationService,
    EscalationPolicyService,
)
from incidents.selectors import get_incident
from organizations.permissions import IsOrganizationMember
from organizations.selectors import user_has_permission
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
    description="UUID of the escalation policy.",
)
_LEVEL_ID_PARAM = OpenApiParameter(
    name="level_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the escalation level.",
)
_INCIDENT_ID_PARAM = OpenApiParameter(
    name="incident_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the incident.",
)


# ---------------------------------------------------------------------------
# Escalation Policy views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Escalation Policies"])
class EscalationPolicyListCreateView(APIView):
    """
    List or create escalation policies for an organization.
    GET/POST /api/v1/organizations/<organization_id>/escalation-policies/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="List escalation policies",
        description=(
            "Returns all escalation policies scoped to the organization. "
            "Requires escalation.view permission."
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
            200: EscalationPolicySerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.view"
        ):
            raise PermissionDenied(
                "You do not have permission to view escalation policies."
            )

        is_active_param = request.query_params.get("is_active")
        is_active = None
        if is_active_param is not None:
            is_active = is_active_param.lower() in ("true", "1")

        policies = get_escalation_policies(request.organization, is_active=is_active)
        return Response(
            EscalationPolicySerializer(policies, many=True).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Create escalation policy",
        description=(
            "Create a new escalation policy for the organization. "
            "Requires escalation.manage permission."
        ),
        parameters=[_ORG_ID_PARAM],
        request=EscalationPolicyCreateSerializer,
        responses={
            201: EscalationPolicySerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def post(self, request, organization_id):
        serializer = EscalationPolicyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        policy = EscalationPolicyService.create_escalation_policy(
            organization=request.organization,
            actor_membership=request.membership,
            name=data["name"],
            description=data.get("description", ""),
            is_active=data.get("is_active", True),
            is_default=data.get("is_default", False),
        )
        return Response(
            EscalationPolicySerializer(policy).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["Escalation Policies"])
class EscalationPolicyDetailView(APIView):
    """
    Retrieve or update an escalation policy.
    GET/PATCH /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_policy_or_404(self, request, policy_id):
        policy = get_escalation_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("Escalation policy not found.")
        return policy

    @extend_schema(
        summary="Get escalation policy detail",
        description="Retrieve a single escalation policy including its levels and rules.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        responses={
            200: EscalationPolicySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation policy not found."),
        },
    )
    def get(self, request, organization_id, policy_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.view"
        ):
            raise PermissionDenied(
                "You do not have permission to view escalation policies."
            )
        policy = self._get_policy_or_404(request, policy_id)
        return Response(
            EscalationPolicySerializer(policy).data, status=status.HTTP_200_OK
        )

    @extend_schema(
        summary="Update escalation policy",
        description=(
            "Update an escalation policy's name, description, active status, or default flag. "
            "Requires escalation.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        request=EscalationPolicyUpdateSerializer,
        responses={
            200: EscalationPolicySerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation policy not found."),
        },
    )
    def patch(self, request, organization_id, policy_id):
        policy = self._get_policy_or_404(request, policy_id)
        serializer = EscalationPolicyUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        updated = EscalationPolicyService.update_escalation_policy(
            policy=policy,
            actor_membership=request.membership,
            name=data.get("name"),
            description=data.get("description"),
            is_active=data.get("is_active"),
            is_default=data.get("is_default"),
        )
        return Response(
            EscalationPolicySerializer(updated).data, status=status.HTTP_200_OK
        )


# ---------------------------------------------------------------------------
# Escalation Level views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Escalation Levels"])
class EscalationLevelListCreateView(APIView):
    """
    List or create escalation levels for a policy.
    GET/POST /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_policy_or_404(self, request, policy_id):
        policy = get_escalation_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("Escalation policy not found.")
        return policy

    @extend_schema(
        summary="List escalation levels",
        description="List all ordered escalation levels for a policy.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        responses={
            200: EscalationLevelSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation policy not found."),
        },
    )
    def get(self, request, organization_id, policy_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.view"
        ):
            raise PermissionDenied(
                "You do not have permission to view escalation policies."
            )
        policy = self._get_policy_or_404(request, policy_id)
        levels = get_escalation_levels(policy)
        return Response(
            EscalationLevelSerializer(levels, many=True).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Create escalation level",
        description=(
            "Create an ordered escalation level within a policy. "
            "Level numbers must be unique per policy. "
            "Requires escalation.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        request=EscalationLevelCreateSerializer,
        responses={
            201: EscalationLevelSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation policy not found."),
        },
    )
    def post(self, request, organization_id, policy_id):
        policy = self._get_policy_or_404(request, policy_id)
        serializer = EscalationLevelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        level = EscalationPolicyService.create_escalation_level(
            policy=policy,
            actor_membership=request.membership,
            level=data["level"],
            name=data["name"],
            delay_minutes=data.get("delay_minutes", 0),
            target_type=data["target_type"],
            target_reference=data.get("target_reference", ""),
        )
        return Response(
            EscalationLevelSerializer(level).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["Escalation Levels"])
class EscalationLevelDetailView(APIView):
    """
    Retrieve or update a single escalation level.
    GET/PATCH /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/<level_id>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_level_or_404(self, request, policy_id, level_id):
        policy = get_escalation_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("Escalation policy not found.")
        level = get_escalation_level(policy, level_id)
        if not level:
            raise NotFound("Escalation level not found.")
        return level

    @extend_schema(
        summary="Get escalation level detail",
        description="Retrieve a single escalation level.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM, _LEVEL_ID_PARAM],
        responses={
            200: EscalationLevelSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation level not found."),
        },
    )
    def get(self, request, organization_id, policy_id, level_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.view"
        ):
            raise PermissionDenied(
                "You do not have permission to view escalation policies."
            )
        level = self._get_level_or_404(request, policy_id, level_id)
        return Response(
            EscalationLevelSerializer(level).data, status=status.HTTP_200_OK
        )

    @extend_schema(
        summary="Update escalation level",
        description=(
            "Update name, delay, or target on an escalation level. "
            "Requires escalation.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM, _LEVEL_ID_PARAM],
        request=EscalationLevelUpdateSerializer,
        responses={
            200: EscalationLevelSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation level not found."),
        },
    )
    def patch(self, request, organization_id, policy_id, level_id):
        level = self._get_level_or_404(request, policy_id, level_id)
        serializer = EscalationLevelUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        updated = EscalationPolicyService.update_escalation_level(
            escalation_level=level,
            actor_membership=request.membership,
            name=data.get("name"),
            delay_minutes=data.get("delay_minutes"),
            target_type=data.get("target_type"),
            target_reference=data.get("target_reference"),
        )
        return Response(
            EscalationLevelSerializer(updated).data, status=status.HTTP_200_OK
        )


# ---------------------------------------------------------------------------
# Escalation Rule views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Escalation Rules"])
class EscalationRuleListCreateView(APIView):
    """
    List or create escalation rules for a policy.
    GET/POST /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/rules/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_policy_or_404(self, request, policy_id):
        policy = get_escalation_policy(request.organization, policy_id)
        if not policy:
            raise NotFound("Escalation policy not found.")
        return policy

    @extend_schema(
        summary="List escalation rules",
        description="List all trigger rules for an escalation policy.",
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        responses={
            200: EscalationRuleSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation policy not found."),
        },
    )
    def get(self, request, organization_id, policy_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.view"
        ):
            raise PermissionDenied(
                "You do not have permission to view escalation policies."
            )
        policy = self._get_policy_or_404(request, policy_id)
        rules = get_escalation_rules(policy)
        return Response(
            EscalationRuleSerializer(rules, many=True).data, status=status.HTTP_200_OK
        )

    @extend_schema(
        summary="Create escalation rule",
        description=(
            "Create a trigger rule for an escalation policy. "
            "One rule per trigger_type per policy. "
            "Requires escalation.manage permission."
        ),
        parameters=[_ORG_ID_PARAM, _POLICY_ID_PARAM],
        request=EscalationRuleCreateSerializer,
        responses={
            201: EscalationRuleSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Escalation policy not found."),
        },
    )
    def post(self, request, organization_id, policy_id):
        policy = self._get_policy_or_404(request, policy_id)
        serializer = EscalationRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        rule = EscalationPolicyService.create_escalation_rule(
            policy=policy,
            actor_membership=request.membership,
            trigger_type=data["trigger_type"],
            is_active=data.get("is_active", True),
        )
        return Response(
            EscalationRuleSerializer(rule).data, status=status.HTTP_201_CREATED
        )


# ---------------------------------------------------------------------------
# Incident Escalation History views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Incident Escalations"])
class IncidentEscalationHistoryView(APIView):
    """
    Read-only incident escalation history.
    GET /api/v1/organizations/<organization_id>/incidents/<incident_id>/escalations/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    def _get_incident_or_404(self, request, incident_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")
        return incident

    @extend_schema(
        summary="List incident escalation history",
        description=(
            "Returns all escalation tracking records and event history for an incident. "
            "Results are filtered by organization — tenant-isolated. "
            "Requires escalation.view permission."
        ),
        parameters=[
            _ORG_ID_PARAM,
            _INCIDENT_ID_PARAM,
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by escalation status (ACTIVE, COMPLETED, CANCELLED).",
                required=False,
            ),
            OpenApiParameter(
                name="trigger_type",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by trigger type (RESPONSE_BREACH, RESOLUTION_BREACH).",
                required=False,
            ),
        ],
        responses={
            200: IncidentEscalationSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def get(self, request, organization_id, incident_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.view"
        ):
            raise PermissionDenied(
                "You do not have permission to view escalation history."
            )

        incident = self._get_incident_or_404(request, incident_id)

        status_filter = request.query_params.get("status")
        trigger_filter = request.query_params.get("trigger_type")

        escalations = get_incident_escalations(
            incident=incident,
            status=status_filter,
            trigger_type=trigger_filter,
        )

        # Prefetch events to avoid N+1.
        escalations = escalations.prefetch_related("events")

        return Response(
            IncidentEscalationSerializer(escalations, many=True).data,
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["Incident Escalations"])
class IncidentEscalationEvaluateView(APIView):
    """
    Manually trigger escalation evaluation for an incident.
    POST /api/v1/organizations/<organization_id>/incidents/<incident_id>/escalations/evaluate/

    Requires escalation.evaluate permission.
    This endpoint is idempotent — repeated calls produce no duplicate events.
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="Evaluate incident escalation",
        description=(
            "Manually evaluate escalation for an incident and trigger type. "
            "The operation is idempotent — repeated calls will not create duplicate events. "
            "Requires escalation.evaluate permission."
        ),
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM],
        request=EscalationEvaluateSerializer,
        responses={
            200: IncidentEscalationSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def post(self, request, organization_id, incident_id):
        if not user_has_permission(
            request.user, request.organization, "escalation.evaluate"
        ):
            raise PermissionDenied(
                "You do not have permission to evaluate escalations."
            )

        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        serializer = EscalationEvaluateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trigger_type = serializer.validated_data["trigger_type"]

        result = EscalationEvaluationService.evaluate_incident_escalation(
            incident=incident,
            trigger_type=trigger_type,
        )

        if result.escalation:
            # Refresh with events for the response.
            from escalation.selectors import get_incident_escalations

            escalations = get_incident_escalations(
                incident=incident, trigger_type=trigger_type
            ).prefetch_related("events")
            first = escalations.first()
            if first:
                return Response(
                    IncidentEscalationSerializer(first).data, status=status.HTTP_200_OK
                )

        return Response(
            {
                "detail": result.skipped_reason
                or "Evaluation complete. No new levels were executed."
            },
            status=status.HTTP_200_OK,
        )
