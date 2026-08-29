#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from escalation.models import EscalationPolicy, EscalationLevel, EscalationRule, IncidentEscalation, EscalationEvent

print("=== Escalation Policy Status ===")
print(f"Escalation Policies: {EscalationPolicy.objects.count()}")
print(f"Escalation Levels: {EscalationLevel.objects.count()}")
print(f"Escalation Rules: {EscalationRule.objects.count()}")
print(f"Incident Escalations: {IncidentEscalation.objects.count()}")
print(f"Escalation Events: {EscalationEvent.objects.count()}")

policy = EscalationPolicy.objects.first()
if policy:
    print(f"\nPolicy Details:")
    print(f"  Name: {policy.name}")
    print(f"  Active: {policy.is_active}")
    print(f"  Default: {policy.is_default}")
    print(f"  Organization: {policy.organization_id}")

    levels = EscalationLevel.objects.filter(policy=policy).order_by('level')
    print(f"\nLevels ({levels.count()}):")
    for level in levels:
        print(f"  Level {level.level}: {level.name} (Delay: {level.delay_minutes}m, Target: {level.target_type} {level.target_reference})")

    rules = EscalationRule.objects.filter(policy=policy)
    print(f"\nRules ({rules.count()}):")
    for rule in rules:
        print(f"  {rule.trigger_type}: Active={rule.is_active}")
