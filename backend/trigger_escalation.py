#!/usr/bin/env python
import os
import django
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.utils import timezone
from incidents.models import Incident
from sla.models import IncidentSLA
from escalation.services import EscalationEvaluationService

# Get the incident with SLA
incident = Incident.objects.filter(incident_number='INC-000002').first()
if incident and hasattr(incident, 'sla'):
    print(f"Incident: {incident.incident_number}")
    print(f"Current SLA Response Deadline: {incident.sla.response_deadline}")
    print(f"Current SLA Resolution Deadline: {incident.sla.resolution_deadline}")
    
    # Manually breach the SLA by setting the deadline to the past
    incident.sla.response_deadline = timezone.now() - timedelta(minutes=10)
    incident.sla.response_breached = True
    incident.sla.save()
    
    print(f"\nModified SLA Response Deadline: {incident.sla.response_deadline}")
    print(f"Response Breached: {incident.sla.response_breached}")
    
    # Try to trigger escalation
    try:
        EscalationEvaluationService.evaluate_incident_escalation(incident, 'RESPONSE_BREACH')
        print("\nEscalation evaluation completed")
        
        # Check if escalation was created
        from escalation.models import IncidentEscalation
        escalations = IncidentEscalation.objects.filter(incident=incident)
        print(f"Incident Escalations: {escalations.count()}")
        for esc in escalations:
            print(f"  Policy: {esc.policy.name}, Trigger: {esc.trigger_type}, Status: {esc.status}")
    except Exception as e:
        print(f"Escalation evaluation failed: {e}")
else:
    print("Incident or SLA not found")
