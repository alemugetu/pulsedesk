"""
Views for the Attachments module.

URL structure (mirrors comments convention):
  GET  /api/v1/organizations/<org_id>/incidents/<incident_id>/attachments/
  POST /api/v1/organizations/<org_id>/incidents/<incident_id>/attachments/
  GET  /api/v1/organizations/<org_id>/incidents/<incident_id>/attachments/<attachment_id>/download/
  DELETE /api/v1/organizations/<org_id>/incidents/<incident_id>/attachments/<attachment_id>/

Design:
- Views are thin; business logic lives in services/selectors.
- Multipart parsing is declared explicitly via parser_classes (not set globally
  in DRF settings, only JSON parser is the default).
- Downloads are served via Django's FileResponse — fully authorized, no raw
  storage URLs exposed.
- X-Content-Type-Options header is set on downloads to prevent MIME-sniffing.
- Content-Disposition: attachment forces a download, preventing inline execution
  of uploaded content.
"""

import logging
from typing import ClassVar

from attachments.permissions import (
    CanUploadAttachment,
    CanViewIncidentAttachments,
)
from attachments.selectors import get_attachment, get_attachments
from attachments.serializers import AttachmentSerializer, AttachmentUploadSerializer
from attachments.services import AttachmentService, AttachmentValidationError
from django.http import FileResponse
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from incidents.selectors import get_incident
from organizations.permissions import IsOrganizationMember
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAPI path parameters (reused across views)
# ---------------------------------------------------------------------------
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
_ATTACHMENT_ID_PARAM = OpenApiParameter(
    name="attachment_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the attachment.",
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _resolve_incident_or_404(organization, incident_id):
    """Resolve the incident, scoped to organization. Raises NotFound if missing."""
    incident = get_incident(organization, incident_id)
    if not incident:
        raise NotFound("Incident not found.")
    return incident


def _resolve_attachment_or_404(incident, attachment_id):
    """Resolve the attachment, scoped to incident. Raises NotFound if missing."""
    attachment = get_attachment(incident, attachment_id)
    if not attachment:
        raise NotFound("Attachment not found.")
    return attachment


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


@extend_schema(tags=["Incident Attachments"])
class AttachmentListCreateView(APIView):
    """
    List or upload attachments for an incident.

    GET  — paginated list of attachment metadata.
    POST — upload a new attachment (multipart/form-data).
    """

    pagination_class = PageNumberPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [
                IsAuthenticated(),
                IsOrganizationMember(),
                CanUploadAttachment(),
            ]
        return [
            IsAuthenticated(),
            IsOrganizationMember(),
            CanViewIncidentAttachments(),
        ]

    def get_parsers(self):
        if getattr(self, "request", None) and self.request.method == "POST":
            return [MultiPartParser()]
        return [JSONParser()]

    @extend_schema(
        summary="List incident attachments",
        description=(
            "Returns a paginated list of attachment metadata for the specified incident. "
            "Download URLs are authorized — file contents are never returned here."
        ),
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
            200: AttachmentSerializer(many=True),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def get(self, request, organization_id, incident_id):
        incident = _resolve_incident_or_404(request.organization, incident_id)
        attachments_qs = get_attachments(incident)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(attachments_qs, request, view=self)
        if page is not None:
            serializer = AttachmentSerializer(
                page, many=True, context={"request": request}
            )
            return paginator.get_paginated_response(serializer.data)

        serializer = AttachmentSerializer(
            attachments_qs, many=True, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Upload attachment",
        description=(
            "Upload a file attachment to an incident. "
            "Use multipart/form-data with a 'file' field. "
            "Allowed types: JPEG, PNG, WebP, PDF, TXT, LOG. "
            "Maximum size is configured server-side (default 10 MB)."
        ),
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM],
        request={
            "multipart/form-data": AttachmentUploadSerializer,
        },
        responses={
            201: AttachmentSerializer,
            400: OpenApiResponse(description="Validation error (invalid type/size)."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Incident not found."),
        },
    )
    def post(self, request, organization_id, incident_id):
        incident = _resolve_incident_or_404(request.organization, incident_id)

        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]

        try:
            attachment = AttachmentService.upload_attachment(
                incident=incident,
                uploader=request.user,
                uploaded_file=uploaded_file,
            )
        except AttachmentValidationError as exc:
            raise ValidationError(exc.detail) from exc

        output = AttachmentSerializer(attachment, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Incident Attachments"])
class AttachmentDownloadView(APIView):
    """
    Download an authorized attachment.

    Authorization is verified server-side before any file data is returned.
    The response forces a download via Content-Disposition: attachment to
    prevent browsers from executing uploaded content inline.
    X-Content-Type-Options: nosniff prevents MIME-sniffing.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewIncidentAttachments,
    ]

    @extend_schema(
        summary="Download attachment",
        description=(
            "Download the file contents of an attachment. "
            "Authorization is verified server-side. "
            "The response uses Content-Disposition: attachment to force a download."
        ),
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM, _ATTACHMENT_ID_PARAM],
        responses={
            200: OpenApiResponse(description="File binary content."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Attachment not found."),
        },
    )
    def get(self, request, organization_id, incident_id, attachment_id):
        incident = _resolve_incident_or_404(request.organization, incident_id)
        attachment = _resolve_attachment_or_404(incident, attachment_id)

        # Open the file through Django's storage backend — never exposes raw path.
        try:
            file_handle = attachment.file.open("rb")
        except (FileNotFoundError, OSError) as exc:
            logger.error(
                "Attachment file not found in storage: attachment_id=%s, path=%s",
                attachment.id,
                attachment.file.name,
            )
            raise NotFound("Attachment file not found.") from exc

        # Build a safe filename for the Content-Disposition header.
        # Use only the original_filename (display metadata), sanitized.
        safe_filename = attachment.original_filename.replace('"', "").replace("\\", "")

        response = FileResponse(
            file_handle,
            content_type=attachment.content_type,
        )
        # Force download — prevents inline execution of HTML/SVG/etc.
        response["Content-Disposition"] = f'attachment; filename="{safe_filename}"'
        # Prevent MIME-sniffing.
        response["X-Content-Type-Options"] = "nosniff"
        # Prevent the browser from caching attachment data in shared caches.
        response["Cache-Control"] = "private, no-cache"

        return response


@extend_schema(tags=["Incident Attachments"])
class AttachmentDeleteView(APIView):
    """
    Delete an attachment.

    The uploader may always delete their own attachment.
    A member with `incident.manage` permission may delete any attachment on
    an incident within their organization.
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
        CanViewIncidentAttachments,
    ]

    @extend_schema(
        summary="Delete attachment",
        description=(
            "Delete an attachment. "
            "The uploader or a member with `incident.manage` permission may delete."
        ),
        parameters=[_ORG_ID_PARAM, _INCIDENT_ID_PARAM, _ATTACHMENT_ID_PARAM],
        responses={
            204: OpenApiResponse(description="Attachment deleted successfully."),
            401: OpenApiResponse(description="Unauthenticated."),
            403: OpenApiResponse(description="Permission denied."),
            404: OpenApiResponse(description="Attachment not found."),
        },
    )
    def delete(self, request, organization_id, incident_id, attachment_id):
        incident = _resolve_incident_or_404(request.organization, incident_id)
        attachment = _resolve_attachment_or_404(incident, attachment_id)

        try:
            AttachmentService.delete_attachment(
                attachment=attachment,
                requesting_user=request.user,
            )
        except AttachmentValidationError as exc:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(exc.detail) from exc

        return Response(status=status.HTTP_204_NO_CONTENT)
