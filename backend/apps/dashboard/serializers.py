from rest_framework import serializers
from django.utils import timezone
from django.conf import settings
from incidents.models import Incident, IncidentPriority
from sla.models import IncidentSLA

_DEFAULT_WARNING_THRESHOLD = 0.80

class DashboardSummarySerializer(serializers.Serializer):
    open_incidents = serializers.IntegerField()
    unassigned_incidents = serializers.IntegerField()
    sla_at_risk = serializers.IntegerField()
    sla_breached = serializers.IntegerField()
    active_escalations = serializers.IntegerField()

class PriorityDistributionSerializer(serializers.Serializer):
    # Map the internal P1-P4 keys to more descriptive names if needed, 
    # but the requirement showed a map of priority keys.
    # Using dynamic fields since priorities are fixed.
    low = serializers.IntegerField(source="P4")
    medium = serializers.IntegerField(source="P3")
    high = serializers.IntegerField(source="P2")
    critical = serializers.IntegerField(source="P1")

class SLAMetricsSerializer(serializers.Serializer):
    healthy = serializers.IntegerField()
    approaching = serializers.IntegerField()
    breached = serializers.IntegerField()
    resolved_within_sla = serializers.IntegerField()
    response_breaches = serializers.IntegerField()
    resolution_breaches = serializers.IntegerField()

class EscalationMetricsSerializer(serializers.Serializer):
    active = serializers.IntegerField()
    completed = serializers.IntegerField()
    cancelled = serializers.IntegerField()
    by_level = serializers.DictField(child=serializers.IntegerField())

class DashboardIncidentSerializer(serializers.ModelSerializer):
    assignee_email = serializers.EmailField(source="assignee.user.email", read_only=True, allow_null=True)
    sla_state = serializers.SerializerMethodField()
    escalation_status = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            "id",
            "incident_number",
            "title",
            "status",
            "priority",
            "assignee_email",
            "sla_state",
            "escalation_status",
            "created_at",
        ]

    def get_sla_state(self, obj) -> str:
        """
        Derives the SLA state (HEALTHY, AT_RISK, BREACHED) for the incident.
        """
        try:
            sla = obj.sla
        except Exception:
            return "UNKNOWN"
            
        if not sla:
            return "UNKNOWN"

        if sla.response_breached or sla.resolution_breached:
            return "BREACHED"

        now = timezone.now()
        threshold = float(getattr(settings, "SLA_WARNING_THRESHOLD", _DEFAULT_WARNING_THRESHOLD))

        # Check if either response or resolution is approaching
        for deadline, completed_at in [
            (sla.response_deadline, sla.response_completed_at),
            (sla.resolution_deadline, sla.resolution_completed_at),
        ]:
            if completed_at is None:
                total_window = (deadline - sla.created_at).total_seconds()
                if total_window > 0:
                    elapsed = (now - sla.created_at).total_seconds()
                    if (elapsed / total_window) >= threshold:
                        return "AT_RISK"

        return "HEALTHY"

    def get_escalation_status(self, obj) -> str | None:
        """
        Returns the status of the most recent escalation if any.
        """
        # escalations is prefetched in the selector
        latest_escalation = None
        for esc in obj.escalations.all():
            if not latest_escalation or esc.created_at > latest_escalation.created_at:
                latest_escalation = esc
        
        return latest_escalation.status if latest_escalation else None
