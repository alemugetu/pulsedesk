"""
Read-only views for Audit Logs.

URL structure:
  GET /api/v1/organizations/{org_id}/audit-logs/
  GET /api/v1/organizations/{org_id}/audit-logs/{audit_log_id}/

No POST, PATCH, PUT, or DELETE endpoints exist.
Audit creation is internal to domain services only.

Filtering (all query params are optional):
  ?action=<AuditAction value>
  ?resource_type=<string>
  ?resource_id=<string>
  ?actor_id=<uuid>
  ?date_from=<ISO 8601 datetime>
  ?date_to=<ISO 8601 datetime>
"""

from typing import ClassVar

from audit_logs.permissions import CanViewAuditLogs
from audit_logs.selectors import get_audit_log, get_audit_logs
from audit_logs.serializers import AuditLogSerializer
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from organizations.permissions import IsOrganizationMember
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# ---------------------------------------------------------------------------
# OpenAPI path parameters
# ---------------------------------------------------------------------------
_ORG_ID_PARAM = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)
_AUDIT_LOG_ID_PARAM = OpenApiParameter(
    name="audit_log_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the audit log record.",
)

# ---------------------------------------------------------------------------
# Filter parameters (documented for OpenAPI)
# ---------------------------------------------------------------------------
_FILTER_PARAMS = [
    _ORG_ID_PARAM,
    OpenApiParameter(
        name="action",
        type=str,
        location=OpenApiParameter.QUERY,
        description="Filter by action identifier, e.g. 'incident.created'.",
        required=False,
    ),
    OpenApiParameter(
        name="resource_type",
        type=str,
        location=OpenApiParameter.QUERY,
        description="Filter by resource type, e.g. 'incident'.",
        required=False,
    ),
    OpenApiParameter(
        name="resource_id",
        type=str,
        location=OpenApiParameter.QUERY,
        description="Filter by resource ID (the UUID of a specific resource).",
        required=False,
    ),
    OpenApiParameter(
        name="actor_id",
        type=str,
        location=OpenApiParameter.QUERY,
        description="Filter by the UUID of the user who performed the action.",
        required=False,
    ),
    OpenApiParameter(
        name="date_from",
        type=str,
        location=OpenApiParameter.QUERY,
        description="ISO 8601 datetime lower bound (inclusive).",
        required=False,
    ),
    OpenApiParameter(
        name="date_to",
        type=str,
        location=OpenApiParameter.QUERY,
        description="ISO 8601 datetime upper bound (inclusive).",
        required=False,
    ),
    OpenApiParameter(
        name="page",
        type=int,
        location=OpenApiParameter.QUERY,
        description="Page number.",
        required=False,
    ),
]


def _parse_datetime_param(value: str | None):
    """Parse an ISO 8601 datetime string from a query parameter. Returns None on failure."""
    if not value:
        return None
    from django.utils.dateparse import parse_datetime

    dt = parse_datetime(value)
    if dt is None:
        # Try parsing as date (YYYY-MM-DD) and treat as start of day UTC
        import datetime

        from django.utils.dateparse import parse_date
        from django.utils.timezone import make_aware

        d = parse_date(value)
        if d:
            return make_aware(datetime.datetime.combine(d, datetime.time.min))
    return dt


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Audit Logs"])
class AuditLogListView(APIView):
    """
    List audit logs for an organization.

    Read-only endpoint.  Supports filtering and pagination.
    Requires `audit_log.view` permission.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewAuditLogs,
    ]
    pagination_class = PageNumberPagination

    @extend_schema(
        summary="List audit logs",
        description=(
            "Returns a paginated list of audit log entries for the organization. "
            "Supports filtering by action, resource type, resource ID, actor, and date range. "
            "Requires `audit_log.view` permission."
        ),
        parameters=_FILTER_PARAMS,
        responses={
            200: AuditLogSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        qs = get_audit_logs(
            organization=request.organization,
            action=request.query_params.get("action"),
            resource_type=request.query_params.get("resource_type"),
            resource_id=request.query_params.get("resource_id"),
            actor_id=request.query_params.get("actor_id"),
            date_from=_parse_datetime_param(request.query_params.get("date_from")),
            date_to=_parse_datetime_param(request.query_params.get("date_to")),
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        if page is not None:
            serializer = AuditLogSerializer(
                page, many=True, context={"request": request}
            )
            return paginator.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=["Audit Logs"])
class AuditLogDetailView(APIView):
    """
    Retrieve a single audit log record.

    Read-only endpoint.  The record must belong to the requesting user's organization.
    Requires `audit_log.view` permission.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewAuditLogs,
    ]

    @extend_schema(
        summary="Get audit log detail",
        description=(
            "Retrieve a single audit log record by UUID. "
            "The record must belong to the requesting user's organization. "
            "Requires `audit_log.view` permission."
        ),
        parameters=[_ORG_ID_PARAM, _AUDIT_LOG_ID_PARAM],
        responses={
            200: AuditLogSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Audit log not found."),
        },
    )
    def get(self, request, organization_id, audit_log_id):
        audit_log = get_audit_log(request.organization, audit_log_id)
        if not audit_log:
            raise NotFound("Audit log not found.")
        serializer = AuditLogSerializer(audit_log, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
