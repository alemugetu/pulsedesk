from django.urls import reverse
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


@extend_schema(
    tags=["Health"],
    summary="Health check",
    description=(
        "Returns the operational status of the PulseDesk API. "
        "No authentication is required. Suitable for load-balancer health probes."
    ),
    responses={
        200: OpenApiResponse(
            description="API is healthy.",
            examples=[
                OpenApiExample(
                    "Healthy response",
                    value={"status": "healthy", "message": "PulseDesk API is running"},
                )
            ],
        )
    },
)
class HealthCheckView(APIView):
    """
    Health check endpoint to verify API is running.
    """

    permission_classes = ()  # No authentication required

    def get(self, request):
        return Response(
            {
                "status": "healthy",
                "message": "PulseDesk API is running",
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=["Health"],
    summary="API root",
    description="Returns the API name, version, and links to major endpoint groups.",
    responses={200: OpenApiResponse(description="API root information.")},
)
class APIRootView(APIView):
    """
    API root endpoint showing available endpoints.
    """

    permission_classes = ()  # No authentication required

    def get(self, request):
        health_url = request.build_absolute_uri(reverse("api_v1:health"))
        return Response(
            {
                "name": "PulseDesk API",
                "version": "v1",
                "endpoints": {
                    "health": health_url,
                    "auth": request.build_absolute_uri("/api/v1/auth/"),
                    "organizations": request.build_absolute_uri(
                        "/api/v1/organizations/"
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )
