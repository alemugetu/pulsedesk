from typing import ClassVar

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from incidents.selectors import (
    filter_incidents,  # Phase 13.4
    get_categories,
    get_category,
    get_incident,
)
from incidents.serializers import (
    IncidentCategoryCreateSerializer,
    IncidentCategorySerializer,
    IncidentCategoryUpdateSerializer,
    IncidentCreateSerializer,
    IncidentSerializer,
    IncidentUpdateSerializer,
)
from incidents.services import CategoryService, IncidentService
from organizations.permissions import IsOrganizationMember
from organizations.selectors import get_membership_by_id, user_has_permission
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

_ORG_ID_PARAM = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)
_INCIDENT_ID_PARAM = OpenApiParameter(
    name="incident_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the incident.",
)
_CATEGORY_ID_PARAM = OpenApiParameter(
    name="category_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the incident category.",
)


@extend_schema(tags=["Incident Categories"])
class IncidentCategoryListCreateView(APIView):
    """
    List or create incident categories for an organization.
    GET/POST /api/v1/organizations/<organization_id>/incident-categories/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="List incident categories",
        description="Returns all incident categories scoped to the specified organization.",
        parameters=[
            _ORG_ID_PARAM,
            OpenApiParameter(
                name="is_active",
                type=bool,
                location=OpenApiParameter.QUERY,
                description="Filter categories by active status (true/false).",
            ),
        ],
        responses={
            200: IncidentCategorySerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        if not user_has_permission(request.user, request.organization, "incident.view"):
            raise PermissionDenied(
                "You do not have permission to view incident categories."
            )

        is_active_param = request.query_params.get("is_active")
        is_active = None
        if is_active_param is not None:
            is_active = is_active_param.lower() in ("true", "1")

        categories = get_categories(request.organization, is_active=is_active)
        serializer = IncidentCategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create incident category",
        description="Create a new incident category in the organization.",
        parameters=[_ORG_ID_PARAM],
        request=IncidentCategoryCreateSerializer,
        responses={
            210: IncidentCategorySerializer,
            201: IncidentCategorySerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def post(self, request, organization_id):
        if not user_has_permission(
            request.user, request.organization, "incident.create"
        ):
            raise PermissionDenied(
                "You do not have permission to create incident categories."
            )

        serializer = IncidentCategoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        category = CategoryService.create_category(
            organization=request.organization,
            name=serializer.validated_data["name"],
            slug=serializer.validated_data.get("slug") or None,
            description=serializer.validated_data.get("description", ""),
        )

        output_serializer = IncidentCategorySerializer(category)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Incident Categories"])
class IncidentCategoryDetailView(APIView):
    """
    Retrieve or update an incident category.
    GET/PATCH /api/v1/organizations/<organization_id>/incident-categories/<category_id>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="Get incident category detail",
        description="Retrieve details of a single incident category by ID.",
        parameters=[_ORG_ID_PARAM, _CATEGORY_ID_PARAM],
        responses={
            200: IncidentCategorySerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Category not found."),
        },
    )
    def get(self, request, organization_id, category_id):
        if not user_has_permission(request.user, request.organization, "incident.view"):
            raise PermissionDenied(
                "You do not have permission to view incident categories."
            )

        category = get_category(request.organization, category_id)
        if not category:
            raise NotFound("Incident category not found.")

        serializer = IncidentCategorySerializer(category)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update incident category",
        description="Update an incident category's name, description, or active status.",
        parameters=[_ORG_ID_PARAM, _CATEGORY_ID_PARAM],
        request=IncidentCategoryUpdateSerializer,
        responses={
            200: IncidentCategorySerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Category not found."),
        },
    )
    def patch(self, request, organization_id, category_id):
        if not user_has_permission(
            request.user, request.organization, "incident.create"
        ):
            raise PermissionDenied(
                "You do not have permission to update incident categories."
            )

        category = get_category(request.organization, category_id)
        if not category:
            raise NotFound("Incident category not found.")

        serializer = IncidentCategoryUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_category = CategoryService.update_category(
            category=category,
            name=serializer.validated_data.get("name"),
            description=serializer.validated_data.get("description"),
            is_active=serializer.validated_data.get("is_active"),
        )

        output_serializer = IncidentCategorySerializer(updated_category)
        return Response(output_serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=["Incidents"])
class IncidentListCreateView(APIView):
    """
    List or create incidents for an organization.
    GET/POST /api/v1/organizations/<organization_id>/incidents/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]
    pagination_class = PageNumberPagination

    @extend_schema(
        summary="List organization incidents",
        description=(
            "Returns a paginated, searchable, filterable, and sortable list "
            "of incidents scoped to the organization."
        ),
        parameters=[
            _ORG_ID_PARAM,
            # -- Text search --
            OpenApiParameter(
                name="search",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Case-insensitive text search across incident title, "
                    "description, and incident number."
                ),
            ),
            # -- Structured filters --
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter by incident status. "
                    "Valid: OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED."
                ),
            ),
            OpenApiParameter(
                name="priority",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by priority. Valid: P1, P2, P3, P4.",
            ),
            OpenApiParameter(
                name="assignee",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter by assignee membership UUID. "
                    "Must belong to the same organization."
                ),
            ),
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter by incident category UUID. "
                    "Must belong to the same organization."
                ),
            ),
            OpenApiParameter(
                name="team",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter by team UUID. Not yet implemented (no Team model). "
                    "Always returns empty results."
                ),
            ),
            OpenApiParameter(
                name="created_after",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter incidents created on or after this ISO-8601 "
                    "datetime (e.g. 2026-01-01T00:00:00Z)."
                ),
            ),
            OpenApiParameter(
                name="created_before",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter incidents created on or before this ISO-8601 "
                    "datetime (e.g. 2026-12-31T23:59:59Z)."
                ),
            ),
            OpenApiParameter(
                name="sla_state",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter by SLA state. " "Valid: BREACHED, ON_TRACK, COMPLETED."
                ),
            ),
            # -- Ordering --
            OpenApiParameter(
                name="ordering",
                type=str,
                location=OpenApiParameter.QUERY,
                description=(
                    "Comma-separated list of ordering fields. "
                    "Prefix with '-' for descending. "
                    "Allowed: created_at, updated_at, priority, status, "
                    "sla_deadline, incident_number. "
                    "Default: -created_at."
                ),
            ),
            # -- Pagination --
            OpenApiParameter(
                name="page",
                type=int,
                location=OpenApiParameter.QUERY,
                description="Page number.",
            ),
        ],
        responses={
            200: IncidentSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def get(self, request, organization_id):
        if not user_has_permission(request.user, request.organization, "incident.view"):
            raise PermissionDenied("You do not have permission to view incidents.")

        qp = request.query_params

        incidents_qs = filter_incidents(
            organization=request.organization,
            search=qp.get("search"),
            status=qp.get("status"),
            priority=qp.get("priority"),
            assignee_id=qp.get("assignee"),
            category_id=qp.get("category"),
            created_after=qp.get("created_after"),
            created_before=qp.get("created_before"),
            sla_state=qp.get("sla_state"),
            team_id=qp.get("team"),
            ordering=qp.get("ordering"),
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(incidents_qs, request, view=self)
        if page is not None:
            serializer = IncidentSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = IncidentSerializer(incidents_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create incident",
        description="Create a new incident in the organization.",
        parameters=[_ORG_ID_PARAM],
        request=IncidentCreateSerializer,
        responses={
            201: IncidentSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Organization not found."),
        },
    )
    def post(self, request, organization_id):
        if not user_has_permission(
            request.user, request.organization, "incident.create"
        ):
            raise PermissionDenied("You do not have permission to create incidents.")

        serializer = IncidentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        incident = IncidentService.create_incident(
            organization=request.organization,
            reporter_user=request.user,
            title=serializer.validated_data["title"],
            description=serializer.validated_data.get("description", ""),
            category_id=serializer.validated_data.get("category_id"),
            priority=serializer.validated_data.get("priority"),
            assignee_membership_id=serializer.validated_data.get("assignee_id"),
        )

        output_serializer = IncidentSerializer(incident)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Incidents"])
class IncidentDetailView(APIView):
    """
    Retrieve or update an incident.
    GET/PATCH /api/v1/organizations/<organization_id>/incidents/<incident_id>/
    """

    permission_classes: ClassVar = [IsAuthenticated, IsOrganizationMember]

    @extend_schema(
        summary="Get incident detail",
        description="Retrieve details of a single incident by UUID.",
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM],
        responses={
            200: IncidentSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def get(self, request, organization_id, incident_id):
        if not user_has_permission(request.user, request.organization, "incident.view"):
            raise PermissionDenied("You do not have permission to view incidents.")

        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        serializer = IncidentSerializer(incident)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update incident",
        description="Update incident details, assignment, or transition status lifecycle.",
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM],
        request=IncidentUpdateSerializer,
        responses={
            200: IncidentSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def patch(self, request, organization_id, incident_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        serializer = IncidentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        actor_membership = request.membership

        # Handle title, description, category, priority updates
        if any(k in data for k in ("title", "description", "category_id", "priority")):
            incident = IncidentService.update_incident(
                incident=incident,
                actor_membership=actor_membership,
                title=data.get("title"),
                description=data.get("description"),
                category_id=data.get("category_id"),
                priority=data.get("priority"),
            )

        # Handle assignee update
        if "assignee_id" in data:
            assignee_id = data["assignee_id"]
            assignee_membership = None
            if assignee_id:
                assignee_membership = get_membership_by_id(
                    assignee_id, request.organization
                )
                if not assignee_membership:
                    raise NotFound(
                        "Assignee membership not found in this organization."
                    )

            incident = IncidentService.assign_incident(
                incident=incident,
                actor_membership=actor_membership,
                assignee_membership=assignee_membership,
            )

        # Handle status transition
        if "status" in data:
            incident = IncidentService.transition_incident_status(
                incident=incident,
                actor_membership=actor_membership,
                new_status=data["status"],
            )

        output_serializer = IncidentSerializer(incident)
        return Response(output_serializer.data, status=status.HTTP_200_OK)
