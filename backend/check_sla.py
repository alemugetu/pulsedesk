#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from sla.models import SLAPolicy, SLATarget, IncidentSLA
from incidents.models import Incident
from organizations.models import Organization

print("=== SLA Policy Status ===")
print(f"SLA Policies: {SLAPolicy.objects.count()}")
print(f"SLA Targets: {SLATarget.objects.count()}")
print(f"Incident SLAs: {IncidentSLA.objects.count()}")

policy = SLAPolicy.objects.first()
if policy:
    print(f"\nPolicy Details:")
    print(f"  Name: {policy.name}")
    print(f"  Active: {policy.is_active}")
    print(f"  Default: {policy.is_default}")
    print(f"  Organization: {policy.organization_id}")

    targets = SLATarget.objects.filter(policy=policy)
    print(f"\nTargets ({targets.count()}):")
    for t in targets:
        print(f"  {t.priority}: Response={t.response_time_minutes}m, Resolution={t.resolution_time_minutes}m")

print("\n=== Organization Status ===")
orgs = Organization.objects.all()
print(f"Organizations: {orgs.count()}")
for org in orgs:
    print(f"  {org.id}: {org.name}")

print("\n=== Incident Status ===")
incidents = Incident.objects.all()
print(f"Incidents: {incidents.count()}")
for inc in incidents:
    print(f"  {inc.incident_number}: {inc.title} (SLA: {'Yes' if hasattr(inc, 'sla') else 'No'})")
