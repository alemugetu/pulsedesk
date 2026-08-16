from django.db.models import Count, Q
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Notification, NotificationPreference
from .serializers import (
    MarkAllNotificationsReadSerializer,
    MarkNotificationReadSerializer,
    NotificationListSerializer,
    NotificationPreferenceSerializer,
    NotificationPreferenceUpdateSerializer,
    NotificationSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="List notifications",
        description="List notifications for the authenticated user. Supports filtering by unread status, notification type, and severity.",
        parameters=[
            OpenApiParameter(
                name="unread_only",
                description="Filter to show only unread notifications",
                type=bool,
                required=False,
            ),
            OpenApiParameter(
                name="notification_type",
                description="Filter by notification type",
                type=str,
                enum=["SLA_WARNING", "SLA_BREACH", "ESCALATION_TRIGGERED"],
                required=False,
            ),
            OpenApiParameter(
                name="severity",
                description="Filter by severity",
                type=str,
                enum=["INFO", "WARNING", "CRITICAL"],
                required=False,
            ),
        ],
    ),
    retrieve=extend_schema(
        summary="Get notification details",
        description="Retrieve details of a specific notification.",
    ),
)
class NotificationViewSet(ModelViewSet):
    """
    API endpoint for user notifications.

    Users can only access their own notifications. Multi-tenant isolation is enforced.
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = NotificationSerializer

    def get_queryset(self):
        """
        Get notifications for the authenticated user.

        Enforces user-level isolation - users can only see their own notifications.
        Also supports filtering by unread status, notification type, and severity.
        """
        user = self.request.user
        queryset = Notification.objects.filter(recipient=user)

        # Filter by unread status
        unread_only = self.request.query_params.get("unread_only")
        if unread_only and unread_only.lower() in ["true", "1", "yes"]:
            queryset = queryset.filter(is_read=False)

        # Filter by notification type
        notification_type = self.request.query_params.get("notification_type")
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        # Filter by severity
        severity = self.request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity)

        return queryset.select_related("organization").order_by("-created_at")

    def get_serializer_class(self):
        """Use lightweight serializer for list view."""
        if self.action == "list":
            return NotificationListSerializer
        return NotificationSerializer

    def retrieve(self, request, *args, **kwargs):
        """
        Retrieve a specific notification.

        Enforces object-level authorization - users can only access their own notifications.
        """
        notification = self.get_object()

        # Verify user owns this notification
        if notification.recipient != request.user:
            raise PermissionDenied(
                "You do not have permission to access this notification."
            )

        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """
        Update a notification.

        Users can only update their own notifications and only specific fields.
        """
        notification = self.get_object()

        # Verify user owns this notification
        if notification.recipient != request.user:
            raise PermissionDenied(
                "You do not have permission to modify this notification."
            )

        # Only allow updating is_read field
        allowed_fields = {"is_read"}
        requested_fields = set(request.data.keys())

        if not requested_fields.issubset(allowed_fields):
            raise ValidationError(
                {
                    "detail": "Only 'is_read' field can be updated directly. "
                    "Use the mark-read endpoint for read status changes."
                }
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """
        Partially update a notification.

        Users can only update their own notifications and only specific fields.
        """
        notification = self.get_object()

        # Verify user owns this notification
        if notification.recipient != request.user:
            raise PermissionDenied(
                "You do not have permission to modify this notification."
            )

        # Only allow updating is_read field
        allowed_fields = {"is_read"}
        requested_fields = set(request.data.keys())

        if not requested_fields.issubset(allowed_fields):
            raise ValidationError(
                {
                    "detail": "Only 'is_read' field can be updated directly. "
                    "Use the mark-read endpoint for read status changes."
                }
            )

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Delete a notification.

        Users can only delete their own notifications.
        """
        notification = self.get_object()

        # Verify user owns this notification
        if notification.recipient != request.user:
            raise PermissionDenied(
                "You do not have permission to delete this notification."
            )

        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        summary="Mark notification as read",
        description="Mark a specific notification as read.",
        request=MarkNotificationReadSerializer,
        responses={
            200: OpenApiResponse(
                description="Notification marked as read successfully.",
                examples=[
                    OpenApiExample(
                        "Success",
                        value={
                            "message": "Notification marked as read.",
                            "notification": NotificationSerializer().data,
                        },
                    )
                ],
            ),
        },
    )
    @action(detail=True, methods=["patch"])
    def mark_read(self, request, pk=None):
        """
        Mark a notification as read.

        Sets is_read=True and read_at to current timestamp.
        """
        notification = self.get_object()

        # Verify user owns this notification
        if notification.recipient != request.user:
            raise PermissionDenied(
                "You do not have permission to modify this notification."
            )

        notification.mark_as_read()

        serializer = self.get_serializer(notification)
        return Response(
            {
                "message": "Notification marked as read.",
                "notification": serializer.data,
            }
        )

    @extend_schema(
        summary="Mark notification as unread",
        description="Mark a specific notification as unread.",
        responses={
            200: OpenApiResponse(
                description="Notification marked as unread successfully.",
                examples=[
                    OpenApiExample(
                        "Success",
                        value={
                            "message": "Notification marked as unread.",
                            "notification": NotificationSerializer().data,
                        },
                    )
                ],
            ),
        },
    )
    @action(detail=True, methods=["patch"])
    def mark_unread(self, request, pk=None):
        """
        Mark a notification as unread.

        Sets is_read=False and clears read_at timestamp.
        """
        notification = self.get_object()

        # Verify user owns this notification
        if notification.recipient != request.user:
            raise PermissionDenied(
                "You do not have permission to modify this notification."
            )

        notification.mark_as_unread()

        serializer = self.get_serializer(notification)
        return Response(
            {
                "message": "Notification marked as unread.",
                "notification": serializer.data,
            }
        )

    @extend_schema(
        summary="Mark all notifications as read",
        description="Mark all unread notifications for the authenticated user as read.",
        request=MarkAllNotificationsReadSerializer,
        responses={
            200: OpenApiResponse(
                description="All notifications marked as read successfully.",
                examples=[
                    OpenApiExample(
                        "Success",
                        value={
                            "message": "All notifications marked as read.",
                            "count": 5,
                        },
                    )
                ],
            ),
        },
    )
    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        """
        Mark all unread notifications as read for the authenticated user.

        This is a bulk operation that marks all unread notifications as read.
        """
        user = request.user

        # Get all unread notifications for the user
        unread_notifications = Notification.objects.filter(
            recipient=user, is_read=False
        )

        # Mark all as read
        count = unread_notifications.count()
        unread_notifications.update(is_read=True)

        return Response(
            {
                "message": "All notifications marked as read.",
                "count": count,
            }
        )

    @extend_schema(
        summary="Get unread notification count",
        description="Get the count of unread notifications for the authenticated user.",
        responses={
            200: OpenApiResponse(
                description="Unread count retrieved successfully.",
                examples=[
                    OpenApiExample(
                        "Success",
                        value={"unread_count": 3},
                    )
                ],
            ),
        },
    )
    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """
        Get the count of unread notifications for the authenticated user.

        Uses COUNT() for efficient query without loading all notifications.
        """
        user = request.user

        unread_count = Notification.objects.filter(
            recipient=user, is_read=False
        ).count()

        return Response({"unread_count": unread_count})


@extend_schema_view(
    list=extend_schema(
        summary="List notification preferences",
        description="List notification preferences for the authenticated user across organizations.",
    ),
    retrieve=extend_schema(
        summary="Get notification preferences",
        description="Retrieve notification preferences for a specific organization.",
    ),
)
class NotificationPreferenceViewSet(ModelViewSet):
    """
    API endpoint for user notification preferences.

    Users can manage their notification preferences per organization.
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = NotificationPreferenceSerializer

    def get_queryset(self):
        """
        Get notification preferences for the authenticated user.

        Users can only access their own preferences.
        """
        user = self.request.user
        return NotificationPreference.objects.filter(user=user).select_related(
            "organization"
        )

    def get_serializer_class(self):
        """Use update serializer for update/partial_update actions."""
        if self.action in ["update", "partial_update"]:
            return NotificationPreferenceUpdateSerializer
        return NotificationPreferenceSerializer

    def retrieve(self, request, *args, **kwargs):
        """
        Retrieve notification preferences.

        Users can only access their own preferences.
        """
        preference = self.get_object()

        # Verify user owns this preference
        if preference.user != request.user:
            raise PermissionDenied(
                "You do not have permission to access these preferences."
            )

        serializer = self.get_serializer(preference)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """
        Update notification preferences.

        Users can only update their own preferences.
        """
        preference = self.get_object()

        # Verify user owns this preference
        if preference.user != request.user:
            raise PermissionDenied(
                "You do not have permission to modify these preferences."
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """
        Partially update notification preferences.

        Users can only update their own preferences.
        """
        preference = self.get_object()

        # Verify user owns this preference
        if preference.user != request.user:
            raise PermissionDenied(
                "You do not have permission to modify these preferences."
            )

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Delete notification preferences.

        Users can only delete their own preferences.
        """
        preference = self.get_object()

        # Verify user owns this preference
        if preference.user != request.user:
            raise PermissionDenied(
                "You do not have permission to delete these preferences."
            )

        return super().destroy(request, *args, **kwargs)
