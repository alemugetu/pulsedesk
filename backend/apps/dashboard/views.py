from typing import ClassVar

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from organizations.permissions import IsOrganizationMember
from rest_framework import status
from rest_framework.filters import OrderingFilter
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import CanViewDashboard
from .selectors import (
    get_dashboard_incidents,
    get_dashboard_summary,
    get_escalation_metrics,
    get_priority_distribution,
    get_sla_metrics,
)
from .serializers import (
    DashboardIncidentSerializer,
    DashboardSummarySerializer,
    EscalationMetricsSerializer,
    PriorityDistributionSerializer,
    SLAMetricsSerializer,
)


class DashboardPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 500


_ORG_ID_PARAM = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)


@extend_schema(tags=["Dashboard"])
class DashboardSummaryView(APIView):
    """
    Get high-level operational summary for the organization.
    GET /api/v1/organizations/<organization_id>/dashboard/summary/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewDashboard,
    ]

    @extend_schema(
        summary="Dashboard Summary",
        description="Returns aggregate counts for open incidents, unassigned, SLA at risk, breached, and active escalations.",
        parameters=[_ORG_ID_PARAM],
        responses={
            200: DashboardSummarySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        summary = get_dashboard_summary(request.organization)
        serializer = DashboardSummarySerializer(summary)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=["Dashboard"])
class PriorityDistributionView(APIView):
    """
    Get incident distribution by priority.
    GET /api/v1/organizations/<organization_id>/dashboard/priority-distribution/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewDashboard,
    ]

    @extend_schema(
        summary="Priority Distribution",
        description="Returns incident counts grouped by priority (low, medium, high, critical).",
        parameters=[_ORG_ID_PARAM],
        responses={
            200: PriorityDistributionSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        distribution = get_priority_distribution(request.organization)
        serializer = PriorityDistributionSerializer(distribution)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=["Dashboard"])
class SLAMetricsView(APIView):
    """
    Get detailed SLA metrics for the dashboard.
    GET /api/v1/organizations/<organization_id>/dashboard/sla-metrics/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewDashboard,
    ]

    @extend_schema(
        summary="SLA Metrics",
        description="Returns detailed SLA performance metrics (healthy, approaching, breached, etc.).",
        parameters=[_ORG_ID_PARAM],
        responses={
            200: SLAMetricsSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        metrics = get_sla_metrics(request.organization)
        serializer = SLAMetricsSerializer(metrics)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=["Dashboard"])
class EscalationMetricsView(APIView):
    """
    Get detailed escalation metrics for the dashboard.
    GET /api/v1/organizations/<organization_id>/dashboard/escalation-metrics/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewDashboard,
    ]

    @extend_schema(
        summary="Escalation Metrics",
        description="Returns aggregate counts for escalations by status and level.",
        parameters=[_ORG_ID_PARAM],
        responses={
            200: EscalationMetricsSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        metrics = get_escalation_metrics(request.organization)
        serializer = EscalationMetricsSerializer(metrics)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=["Dashboard"])
class DashboardIncidentListView(ListAPIView):
    """
    Operations view for incidents with dashboard-specific filtering.
    GET /api/v1/organizations/<organization_id>/dashboard/incidents/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewDashboard,
    ]
    serializer_class = DashboardIncidentSerializer
    pagination_class = DashboardPagination
    filter_backends: ClassVar = [OrderingFilter]
    ordering_fields: ClassVar[list[str]] = ["created_at", "priority", "status", "id"]
    ordering: ClassVar[list[str]] = ["-created_at"]

    @extend_schema(
        summary="Dashboard Incident Operations View",
        description="Returns a read-optimized list of incidents with advanced filtering for operational oversight.",
        parameters=[
            _ORG_ID_PARAM,
            OpenApiParameter(
                name="status",
                type=str,
                description="Filter by status (OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED).",
            ),
            OpenApiParameter(
                name="priority",
                type=str,
                description="Filter by priority (P1, P2, P3, P4).",
            ),
            OpenApiParameter(
                name="assignee_id",
                type=str,
                description="Filter by assignee membership UUID.",
            ),
            OpenApiParameter(
                name="sla_state",
                type=str,
                enum=["HEALTHY", "AT_RISK", "BREACHED"],
                description="Filter by SLA state.",
            ),
            OpenApiParameter(
                name="escalation_state",
                type=str,
                enum=["ACTIVE", "COMPLETED", "CANCELLED"],
                description="Filter by escalation status.",
            ),
            OpenApiParameter(name="page", type=int, description="Page number."),
            OpenApiParameter(
                name="page_size", type=int, description="Items per page (max 500)."
            ),
            OpenApiParameter(
                name="ordering",
                type=str,
                description="Order by fields: created_at, priority, status, id. Prefix with - for descending.",
            ),
        ],
        responses={
            200: DashboardIncidentSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get_queryset(self):
        return get_dashboard_incidents(
            organization=self.request.organization,
            status=self.request.query_params.get("status"),
            priority=self.request.query_params.get("priority"),
            assignee_id=self.request.query_params.get("assignee_id"),
            sla_state=self.request.query_params.get("sla_state"),
            escalation_state=self.request.query_params.get("escalation_state"),
        )
