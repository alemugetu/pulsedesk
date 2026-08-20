from typing import ClassVar

from comments.permissions import (
    CanCreateComment,
    CanViewIncidentComments,
    IsCommentAuthorOrReadOnly,
)
from comments.selectors import get_comment, get_comments
from comments.serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    CommentUpdateSerializer,
)
from comments.services import CommentService
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from incidents.selectors import get_incident
from organizations.permissions import IsOrganizationMember
from rest_framework import status
from rest_framework.exceptions import NotFound
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
_COMMENT_ID_PARAM = OpenApiParameter(
    name="comment_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the comment.",
)


@extend_schema(tags=["Incident Comments"])
class CommentListCreateView(APIView):
    """
    List or create comments for an incident.
    GET/POST /api/v1/organizations/<organization_id>/incidents/<incident_id>/comments/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
    ]
    pagination_class = PageNumberPagination

    def get_permissions(self):
        """
        Dynamically set permissions based on request method.
        GET requires CanViewIncidentComments, POST requires CanCreateComment.
        """
        if self.request.method == "GET":
            return [
                IsAuthenticated(),
                IsOrganizationMember(),
                CanViewIncidentComments(),
            ]
        elif self.request.method == "POST":
            return [IsAuthenticated(), IsOrganizationMember(), CanCreateComment()]
        return super().get_permissions()

    @extend_schema(
        summary="List incident comments",
        description="Returns a paginated list of comments for the specified incident.",
        parameters=[
            _ORG_ID_PARAM,
            _INCIDENT_ID_PARAM,
            OpenApiParameter(
                name="page",
                type=int,
                location=OpenApiParameter.QUERY,
                description="Page number.",
            ),
        ],
        responses={
            200: CommentSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def get(self, request, organization_id, incident_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        comments_qs = get_comments(incident)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(comments_qs, request, view=self)
        if page is not None:
            serializer = CommentSerializer(
                page, many=True, context={"request": request}
            )
            return paginator.get_paginated_response(serializer.data)

        serializer = CommentSerializer(
            comments_qs, many=True, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create comment",
        description="Create a new comment on the incident. Supports @username mentions.",
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM],
        request=CommentCreateSerializer,
        responses={
            201: CommentSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def post(self, request, organization_id, incident_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = CommentService.create_comment(
            incident=incident,
            author=request.user,
            body=serializer.validated_data["body"],
            is_internal=serializer.validated_data.get("is_internal", False),
        )

        output_serializer = CommentSerializer(comment, context={"request": request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Incident Comments"])
class CommentDetailView(APIView):
    """
    Retrieve, update, or delete a specific comment.
    GET/PATCH/DELETE /api/v1/organizations/<organization_id>/incidents/<incident_id>/comments/<comment_id>/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewIncidentComments,
        IsCommentAuthorOrReadOnly,
    ]

    @extend_schema(
        summary="Get comment detail",
        description="Retrieve details of a single comment by UUID.",
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM, _COMMENT_ID_PARAM],
        responses={
            200: CommentSerializer,
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Comment not found."),
        },
    )
    def get(self, request, organization_id, incident_id, comment_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        comment = get_comment(incident, comment_id)
        if not comment:
            raise NotFound("Comment not found.")

        serializer = CommentSerializer(comment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update comment",
        description="Update a comment. Only the comment author may update their own comments.",
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM, _COMMENT_ID_PARAM],
        request=CommentUpdateSerializer,
        responses={
            200: CommentSerializer,
            400: OpenApiResponse(description="Validation error."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Comment not found."),
        },
    )
    def patch(self, request, organization_id, incident_id, comment_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        comment = get_comment(incident, comment_id)
        if not comment:
            raise NotFound("Comment not found.")

        serializer = CommentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_comment = CommentService.update_comment(
            comment=comment,
            author=request.user,
            body=serializer.validated_data.get("body"),
            is_internal=serializer.validated_data.get("is_internal"),
        )

        output_serializer = CommentSerializer(
            updated_comment, context={"request": request}
        )
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Delete comment",
        description="Delete a comment. Only the comment author may delete their own comments.",
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM, _COMMENT_ID_PARAM],
        responses={
            204: OpenApiResponse(description="Comment deleted successfully."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Comment not found."),
        },
    )
    def delete(self, request, organization_id, incident_id, comment_id):
        incident = get_incident(request.organization, incident_id)
        if not incident:
            raise NotFound("Incident not found.")

        comment = get_comment(incident, comment_id)
        if not comment:
            raise NotFound("Comment not found.")

        CommentService.delete_comment(comment, request.user)

        return Response(status=status.HTTP_204_NO_CONTENT)
