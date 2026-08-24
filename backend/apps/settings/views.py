from typing import ClassVar

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from organizations.permissions import IsOrganizationMember, make_permission_class
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from settings.selectors import get_settings_for_organization
from settings.serializers import (
    OrganizationSettingsReadSerializer,
    OrganizationSettingsUpdateSerializer,
)
from settings.services import OrganizationSettingsService

_ORG_ID_PARAMETER = OpenApiParameter(
    name="organization_id",
    type=str,
    location=OpenApiParameter.PATH,
    description="UUID of the organization.",
)


@extend_schema(tags=["Settings"])
class OrganizationSettingsDetailView(APIView):
    """
    GET /api/v1/organizations/<uuid>/settings/
    PATCH /api/v1/organizations/<uuid>/settings/
    """

    permission_classes: ClassVar = [
        IsAuthenticated,
        IsOrganizationMember,
    ]

    # ── GET ────────────────────────────────────────────────────────────

    @extend_schema(
        summary="Retrieve organization settings",
        description=(
            "Returns the operational settings for the specified organization.\n\n"
            "**Required permission: `settings.view`**\n\n"
            "If the organization was created before the settings subsystem "
            "was introduced, a default settings record is created "
            "transparently and returned (existing orgs are safe)."
        ),
        parameters=[_ORG_ID_PARAMETER],
        responses={
            200: OrganizationSettingsReadSerializer,
            401: OpenApiResponse(description="Authentication credentials not provided."),
            403: OpenApiResponse(
                description=(
                    "Missing `settings.view` permission, or membership is "
                    "suspended/removed."
                )
            ),
            404: OpenApiResponse(
                description="Organization not found or user is not a member."
            ),
        },
        examples=[
            OpenApiExample(
                "Default settings response",
                value={
                    "id": "018f1a2b-0100-0000-0000-000000000001",
                    "default_incident_priority": "P3",
                    "default_incident_status": "OPEN",
                    "incident_comments_enabled": True,
                    "notification_incident_emails_enabled": True,
                    "notification_escalation_emails_enabled": True,
                    "notification_sla_emails_enabled": True,
                    "sla_auto_apply_default_policy": True,
                    "escalation_auto_apply_default_policy": True,
                    "created_at": "2026-01-01T09:00:00Z",
                    "updated_at": "2026-01-01T09:00:00Z",
                },
                response_only=True,
            )
        ],
    )
    def get(self, request, organization_id):
        from organizations.selectors import user_has_permission

        if not user_has_permission(
            request.user, request.organization, "settings.view"
        ):
            return Response(
                {"detail": "You do not have permission to view organization settings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        settings = get_settings_for_organization(request.organization)
        serializer = OrganizationSettingsReadSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ── PATCH ──────────────────────────────────────────────────────────

    @extend_schema(
        summary="Update organization settings",
        description=(
            "Partially updates the organization's operational settings.\n\n"
            "**Required permission: `settings.manage`**\n\n"
            "**Rules:**\n"
            "- Only fields present in the request body are changed.\n"
            "- Unknown/unsupported fields are rejected with a 400 "
            "`unknown_fields` error.\n"
            "- Enum values (`default_incident_priority`, "
            "`default_incident_status`) must be valid choices.\n"
            "- Boolean fields must be actual booleans.\n"
            "- The `organization` relationship cannot be changed via this API.\n"
            "- Each successful update creates an immutable audit log entry "
            "with the changed before/after values."
        ),
        parameters=[_ORG_ID_PARAMETER],
        request=OrganizationSettingsUpdateSerializer,
        responses={
            200: OrganizationSettingsReadSerializer,
            400: OpenApiResponse(
                description="Validation error — invalid values or unknown fields.",
                examples=[
                    OpenApiExample(
                        "Unknown field rejected",
                        value={
                            "detail": (
                                "Unknown setting field(s): ['unknown_field']. "
                                "Allowed fields: ['default_incident_priority', ...]."
                            ),
                            "code": "unknown_fields",
                        },
                    ),
                    OpenApiExample(
                        "Invalid priority",
                        value={
                            "default_incident_priority": [
                                '"P9" is not a valid choice.'
                            ]
                        },
                    ),
                ],
            ),
            401: OpenApiResponse(description="Authentication credentials not provided."),
            403: OpenApiResponse(
                description=(
                    "Missing `settings.manage` permission, or membership is "
                    "suspended/removed."
                )
            ),
            404: OpenApiResponse(
                description="Organization not found or user is not a member."
            ),
        },
        examples=[
            OpenApiExample(
                "Partial update request",
                value={
                    "default_incident_priority": "P2",
                    "incident_comments_enabled": False,
                },
                request_only=True,
            ),
            OpenApiExample(
                "Updated settings response",
                value={
                    "id": "018f1a2b-0100-0000-0000-000000000001",
                    "default_incident_priority": "P2",
                    "default_incident_status": "OPEN",
                    "incident_comments_enabled": False,
                    "notification_incident_emails_enabled": True,
                    "notification_escalation_emails_enabled": True,
                    "notification_sla_emails_enabled": True,
                    "sla_auto_apply_default_policy": True,
                    "escalation_auto_apply_default_policy": True,
                    "created_at": "2026-01-01T09:00:00Z",
                    "updated_at": "2026-01-02T14:30:00Z",
                },
                response_only=True,
            ),
        ],
    )
    def patch(self, request, organization_id):
        from organizations.selectors import user_has_permission

        if not user_has_permission(
            request.user, request.organization, "settings.manage"
        ):
            return Response(
                {"detail": "You do not have permission to manage organization settings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        settings = get_settings_for_organization(request.organization)
        serializer = OrganizationSettingsUpdateSerializer(
            settings,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = serializer.validated_data
        OrganizationSettingsService.update_settings(
            settings,
            actor=request.user,
            request=request,
            **validated,
        )

        settings.refresh_from_db()
        read_serializer = OrganizationSettingsReadSerializer(settings)
        return Response(read_serializer.data, status=status.HTTP_200_OK)
