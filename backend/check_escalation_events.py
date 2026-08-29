#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from escalation.models import IncidentEscalation, EscalationEvent
from incidents.models import Incident

incident = Incident.objects.filter(incident_number='INC-000002').first()
if incident:
    print(f"Incident: {incident.incident_number}")
    
    escalations = IncidentEscalation.objects.filter(incident=incident)
    print(f"\nIncident Escalations: {escalations.count()}")
    for esc in escalations:
        print(f"  Policy: {esc.policy.name}")
        print(f"  Trigger: {esc.trigger_type}")
        print(f"  Status: {esc.status}")
        print(f"  Current Level: {esc.current_level}")
        print(f"  Started At: {esc.started_at}")
        
        events = EscalationEvent.objects.filter(incident_escalation=esc)
        print(f"\n  Escalation Events: {events.count()}")
        for event in events:
            print(f"    Level {event.level}: {event.target_type} {event.target_reference}")
            print(f"    Triggered At: {event.triggered_at}")
            print(f"    Status: {event.status}")
