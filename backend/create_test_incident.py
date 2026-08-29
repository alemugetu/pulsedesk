#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from incidents.models import Incident, IncidentPriority
from incidents.services import IncidentService
from organizations.models import Organization, Membership
from accounts.models import User

# Get the organization
org = Organization.objects.first()
print(f"Organization: {org.name} ({org.id})")

# Get the user with active membership
user = User.objects.filter(email='alemugetu78@gmail.com').first()
print(f"User: {user.email} ({user.id})")

# Get the user's membership
membership = Membership.objects.filter(user=user, organization=org, status='ACTIVE').first()
print(f"Membership: {membership.id if membership else 'None'}")

if membership:
    # Create a new incident with P1 priority to trigger SLA
    incident = IncidentService.create_incident(
        organization=org,
        reporter_user=user,
        title="SLA Test Incident",
        description="This incident should have SLA data attached",
        priority=IncidentPriority.P1,
    )
    print(f"\nCreated incident: {incident.incident_number} ({incident.id})")
    print(f"Has SLA: {hasattr(incident, 'sla')}")
    if hasattr(incident, 'sla'):
        print(f"SLA Response Deadline: {incident.sla.response_deadline}")
        print(f"SLA Resolution Deadline: {incident.sla.resolution_deadline}")
        print(f"SLA Response Breached: {incident.sla.response_breached}")
        print(f"SLA Resolution Breached: {incident.sla.resolution_breached}")
else:
    print("No active membership found for user in organization")
