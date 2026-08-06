from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class HealthCheckView(APIView):
    """
    Health check endpoint to verify API is running.
    """
    permission_classes = []  # No authentication required
    
    def get(self, request):
        return Response(
            {
                'status': 'healthy',
                'message': 'PulseDesk API is running',
            },
            status=status.HTTP_200_OK
        )
