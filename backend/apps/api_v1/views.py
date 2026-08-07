from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


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
                    "organizations": request.build_absolute_uri("/api/v1/organizations/"),
                },
            },
            status=status.HTTP_200_OK,
        )
