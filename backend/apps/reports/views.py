"""
Report Views — Phase 13.5

Read-only API views for operational reporting.

All views follow the existing PulseDesk API structure with:
- Organization scoping via URL parameter
- RBAC permission checks
- OpenAPI documentation
- Date range filtering
"""

from typing import ClassVar

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from organizations.permissions import IsOrganizationMember
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import CanViewReports
from .selectors import (
    get_average_resolution_time,
    get_escalation_activity,
    get_incident_summary,
    get_incident_trend,
    get_incidents_by_category,
    get_incidents_by_priority,
    get_incidents_by_status,
    get_sla_performance,
)
from .serializers import (
    AverageResolutionTimeSerializer,
    EscalationActivitySerializer,
    IncidentsByCategorySerializer,
    IncidentsByPrioritySerializer,
    IncidentsByStatusSerializer,
    IncidentSummarySerializer,
    IncidentTrendSerializer,
    SLAPerformanceSerializer,
)

# ---------------------------------------------------------------------------
# Common OpenAPI Parameters
# ---------------------------------------------------------------------------

_ORG_ID_PARAM = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)

_START_PARAM = OpenApiParameter(
    name="start",
    type=str,
    location=OpenApiParameter.QUERY,
    description="Start date in ISO-8601 format (e.g., 2026-01-01T00:00:00Z). Default: 30 days ago.",
    required=False,
)

_END_PARAM = OpenApiParameter(
    name="end",
    type=str,
    location=OpenApiParameter.QUERY,
    description="End date in ISO-8601 format (e.g., 2026-01-31T23:59:59Z). Default: now.",
    required=False,
)

_GRANULARITY_PARAM = OpenApiParameter(
    name="granularity",
    type=str,
    location=OpenApiParameter.QUERY,
    description="Time granularity for trend reports: 'daily' or 'weekly'. Default: 'daily'.",
    required=False,
    enum=["daily", "weekly"],
)


# ---------------------------------------------------------------------------
# Incident Summary View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class IncidentSummaryView(APIView):
    """
    Get incident summary metrics for the organization.

    Returns aggregate counts for total, open, resolved, closed,
    unassigned, and critical incidents within the date range.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Incident Summary",
        description="Returns organization-scoped incident summary metrics including total, open, resolved, closed, unassigned, and critical incidents.",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: IncidentSummarySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        summary = get_incident_summary(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = IncidentSummarySerializer(summary)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Incidents by Status View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class IncidentsByStatusView(APIView):
    """
    Get incident counts grouped by status.

    Returns counts for OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, and CLOSED.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Incidents by Status",
        description="Returns incident counts grouped by status (OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED).",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: IncidentsByStatusSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        status_counts = get_incidents_by_status(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = IncidentsByStatusSerializer(status_counts)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Incidents by Priority View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class IncidentsByPriorityView(APIView):
    """
    Get incident counts grouped by priority.

    Returns counts for P1 (Critical), P2 (High), P3 (Medium), and P4 (Low).
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Incidents by Priority",
        description="Returns incident counts grouped by priority (P1, P2, P3, P4).",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: IncidentsByPrioritySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        priority_counts = get_incidents_by_priority(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = IncidentsByPrioritySerializer(priority_counts)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Incidents by Category View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class IncidentsByCategoryView(APIView):
    """
    Get incident counts grouped by category.

    Returns category-specific counts including uncategorized incidents.
    Only includes categories belonging to the organization.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Incidents by Category",
        description="Returns incident counts grouped by category, including uncategorized incidents.",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: IncidentsByCategorySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        category_counts = get_incidents_by_category(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = IncidentsByCategorySerializer({"categories": category_counts})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Incident Trend View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class IncidentTrendView(APIView):
    """
    Get incident volume over time.

    Returns incident counts grouped by time period (daily or weekly).
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Incident Trend",
        description="Returns incident volume over time grouped by daily or weekly granularity.",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM, _GRANULARITY_PARAM],
        responses={
            200: IncidentTrendSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
            400: OpenApiResponse(description="Invalid granularity parameter."),
        },
    )
    def get(self, request, organization_id):
        granularity = request.query_params.get("granularity", "daily")

        try:
            trend_data = get_incident_trend(
                organization=request.organization,
                start=request.query_params.get("start"),
                end=request.query_params.get("end"),
                granularity=granularity,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = IncidentTrendSerializer(
            {"granularity": granularity, "data": trend_data}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# SLA Performance View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class SLAPerformanceView(APIView):
    """
    Get SLA performance metrics.

    Returns SLA compliance metrics using authoritative IncidentSLA data.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="SLA Performance",
        description="Returns SLA performance metrics including total incidents, compliant count, breached count, and compliance percentage.",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: SLAPerformanceSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        sla_metrics = get_sla_performance(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = SLAPerformanceSerializer(sla_metrics)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Average Resolution Time View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class AverageResolutionTimeView(APIView):
    """
    Get average resolution time metrics.

    Returns average time to resolve incidents in seconds.
    Only includes incidents with resolved_at timestamp.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Average Resolution Time",
        description="Returns average resolution time in seconds for resolved incidents within the date range.",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: AverageResolutionTimeSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        resolution_metrics = get_average_resolution_time(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = AverageResolutionTimeSerializer(resolution_metrics)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Escalation Activity View
# ---------------------------------------------------------------------------


@extend_schema(tags=["Reports"])
class EscalationActivityView(APIView):
    """
    Get escalation activity metrics.

    Returns escalation event counts grouped by level and trigger type.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewReports,
    ]

    @extend_schema(
        summary="Escalation Activity",
        description="Returns escalation activity metrics including total events, counts by level, and counts by trigger type.",
        parameters=[_ORG_ID_PARAM, _START_PARAM, _END_PARAM],
        responses={
            200: EscalationActivitySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        escalation_metrics = get_escalation_activity(
            organization=request.organization,
            start=request.query_params.get("start"),
            end=request.query_params.get("end"),
        )
        serializer = EscalationActivitySerializer(escalation_metrics)
        return Response(serializer.data, status=status.HTTP_200_OK)
