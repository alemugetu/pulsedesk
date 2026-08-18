from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from incidents.services import IncidentService
from organizations.services import OrganizationService
from sla.services import SLAPolicyService, SLACalculationService
from escalation.services import EscalationPolicyService, EscalationEvaluationService
from escalation.models import EscalationTriggerType, EscalationStatus
from dashboard.selectors import (
    get_dashboard_summary,
    get_priority_distribution,
    get_sla_metrics,
    get_escalation_metrics,
    get_dashboard_incidents,
)

User = get_user_model()

class DashboardSelectorsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="test@example.com", password="Password123!")
        self.org = OrganizationService.create_organization(user=self.user, name="Test Org")
        self.membership = self.user.memberships.get(organization=self.org)
        
        # Setup SLA Policy
        self.sla_policy = SLAPolicyService.create_sla_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default SLA",
            is_default=True,
        )
        SLAPolicyService.create_sla_target(
            policy=self.sla_policy,
            actor_membership=self.membership,
            priority="P1",
            response_time_minutes=10,
            resolution_time_minutes=30,
        )
        SLAPolicyService.create_sla_target(
            policy=self.sla_policy,
            actor_membership=self.membership,
            priority="P3",
            response_time_minutes=60,
            resolution_time_minutes=240,
        )
        
        # Setup Escalation Policy
        self.esc_policy = EscalationPolicyService.create_escalation_policy(
            organization=self.org,
            actor_membership=self.membership,
            name="Default Escalation",
            is_default=True,
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.esc_policy,
            actor_membership=self.membership,
            level=1,
            name="Level 1",
            delay_minutes=0,
            target_type="ROLE",
            target_reference=str(self.membership.role.id)
        )
        EscalationPolicyService.create_escalation_level(
            policy=self.esc_policy,
            actor_membership=self.membership,
            level=2,
            name="Level 2",
            delay_minutes=60,
            target_type="ROLE",
            target_reference=str(self.membership.role.id)
        )
        EscalationPolicyService.create_escalation_rule(
            policy=self.esc_policy,
            actor_membership=self.membership,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH
        )

    def test_get_dashboard_summary(self):
        # 1. Unassigned, Open, Healthy SLA
        IncidentService.create_incident(self.org, self.user, "Incident 1", priority="P3")
        
        # 2. Assigned, Open, Breached SLA
        inc2 = IncidentService.create_incident(self.org, self.user, "Incident 2", priority="P1")
        IncidentService.assign_incident(inc2, self.membership, self.membership)
        
        # Manually breach inc2 SLA
        sla2 = inc2.sla
        sla2.response_deadline = timezone.now() - timedelta(minutes=1)
        sla2.save()
        SLACalculationService.evaluate_sla_status(sla2)
        
        # Trigger escalation for inc2
        EscalationEvaluationService.evaluate_incident_escalation(
            incident=inc2,
            trigger_type=EscalationTriggerType.RESPONSE_BREACH
        )
        
        # 3. At Risk SLA (90% elapsed)
        inc3 = IncidentService.create_incident(self.org, self.user, "Incident 3", priority="P1")
        sla3 = inc3.sla
        # total_window is 10m. elapsed = 9m => 90%
        sla3.created_at = timezone.now() - timedelta(minutes=9)
        sla3.response_deadline = sla3.created_at + timedelta(minutes=10)
        sla3.resolution_deadline = sla3.created_at + timedelta(minutes=30)
        sla3.save()
        
        summary = get_dashboard_summary(self.org)
        
        self.assertEqual(summary["open_incidents"], 3)
        self.assertEqual(summary["unassigned_incidents"], 2) # inc1, inc3
        self.assertEqual(summary["sla_breached"], 1) # inc2
        self.assertEqual(summary["sla_at_risk"], 1) # inc3
        self.assertEqual(summary["active_escalations"], 1) # inc2

    def test_get_priority_distribution(self):
        IncidentService.create_incident(self.org, self.user, "P1", priority="P1")
        IncidentService.create_incident(self.org, self.user, "P1-2", priority="P1")
        IncidentService.create_incident(self.org, self.user, "P3", priority="P3")
        
        dist = get_priority_distribution(self.org)
        self.assertEqual(dist["P1"], 2)
        self.assertEqual(dist["P3"], 1)
        self.assertEqual(dist["P2"], 0)
        self.assertEqual(dist["P4"], 0)

    def test_get_sla_metrics(self):
        # Healthy
        IncidentService.create_incident(self.org, self.user, "Healthy", priority="P3")
        
        # Breached
        inc2 = IncidentService.create_incident(self.org, self.user, "Breached", priority="P1")
        sla2 = inc2.sla
        sla2.response_deadline = timezone.now() - timedelta(minutes=1)
        sla2.save()
        SLACalculationService.evaluate_sla_status(sla2)
        
        # Resolved within SLA
        inc3 = IncidentService.create_incident(self.org, self.user, "Resolved", priority="P1")
        IncidentService.transition_incident_status(inc3, self.membership, "ACKNOWLEDGED")
        IncidentService.transition_incident_status(inc3, self.membership, "IN_PROGRESS")
        IncidentService.transition_incident_status(inc3, self.membership, "RESOLVED")
        
        metrics = get_sla_metrics(self.org)
        self.assertEqual(metrics["healthy"], 1)
        self.assertEqual(metrics["breached"], 1)
        self.assertEqual(metrics["resolved_within_sla"], 1)

    def test_get_dashboard_incidents_filtering(self):
        inc1 = IncidentService.create_incident(self.org, self.user, "Inc 1", priority="P1")
        inc2 = IncidentService.create_incident(self.org, self.user, "Inc 2", priority="P3")
        
        # Filter by priority
        qs = get_dashboard_incidents(self.org, priority="P1")
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs[0].id, inc1.id)
        
        # Filter by SLA state (Breached)
        sla1 = inc1.sla
        sla1.response_deadline = timezone.now() - timedelta(minutes=1)
        sla1.save()
        SLACalculationService.evaluate_sla_status(sla1)
        
        qs = get_dashboard_incidents(self.org, sla_state="BREACHED")
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs[0].id, inc1.id)

    def test_tenant_isolation(self):
        other_user = User.objects.create_user(email="other@example.com", password="Password123!")
        other_org = OrganizationService.create_organization(user=other_user, name="Other Org")
        IncidentService.create_incident(other_org, other_user, "Other Incident")
        
        summary = get_dashboard_summary(self.org)
        self.assertEqual(summary["open_incidents"], 0)
