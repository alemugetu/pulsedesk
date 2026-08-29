import os
import sys
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from organizations.models import Organization
from apps.incidents.views import IncidentListCreateView
from rest_framework.test import force_authenticate

User = get_user_model()
user = User.objects.first()
org = Organization.objects.filter(memberships__user=user).first()

factory = RequestFactory()

for sla_state in ["ON_TRACK", "COMPLETED", "BREACHED", "UNKNOWN"]:
    print(f"Testing sla_state={sla_state}")
    request = factory.get(f'/api/v1/organizations/{org.id}/incidents/', {'page': 1, 'sla_state': sla_state})
    force_authenticate(request, user=user)

    view = IncidentListCreateView.as_view()
    try:
        response = view(request, organization_id=str(org.id))
        response.render()
        print(f"Status: {response.status_code}")
    except Exception as e:
        import traceback
        traceback.print_exc()

print("Done")
