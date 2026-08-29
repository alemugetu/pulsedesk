/**
 * Operations Command Center types for PulseDesk (Phase 13.9).
 *
 * These TypeScript models mirror the REAL backend Operations Dashboard API
 * contract implemented in backend/apps/dashboard/ (serializers.py).
 *
 * Endpoints (all organization-scoped):
 *  - GET .../dashboard/summary/               -> DashboardSummary
 *  - GET .../dashboard/priority-distribution/ -> PriorityDistribution
 *  - GET .../dashboard/sla-metrics/           -> SlaMetrics
 *  - GET .../dashboard/escalation-metrics/    -> EscalationMetrics
 *  - GET .../dashboard/incidents/             -> DashboardIncidentPage (paginated)
 *
 * Only fields that actually exist in the backend serializers are represented.
 * No fabricated fields, percentages, or derived business metrics are added.
 */

import type { IncidentStatus, IncidentPriority } from '../../incidents/types/incident.types';

/**
 * SLA state derived per-incident by the backend
 * (DashboardIncidentSerializer.get_sla_state).
 */
export type DashboardSlaState = 'HEALTHY' | 'AT_RISK' | 'BREACHED' | 'UNKNOWN';

/**
 * Escalation status for an incident's most recent escalation
 * (DashboardIncidentSerializer.get_escalation_status). Null when the incident
 * has no escalation. Mirrors backend EscalationStatus values.
 */
export type DashboardEscalationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | null;

/**
 * GET .../dashboard/summary/
 * Matches DashboardSummarySerializer exactly.
 */
export interface DashboardSummary {
  open_incidents: number;
  unassigned_incidents: number;
  sla_at_risk: number;
  sla_breached: number;
  active_escalations: number;
}

/**
 * GET .../dashboard/priority-distribution/
 * Matches PriorityDistributionSerializer exactly. The backend maps internal
 * priority keys to descriptive names:
 *   critical = P1, high = P2, medium = P3, low = P4
 */
export interface PriorityDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/**
 * GET .../dashboard/sla-metrics/
 * Matches SLAMetricsSerializer exactly.
 */
export interface SlaMetrics {
  healthy: number;
  approaching: number;
  breached: number;
  resolved_within_sla: number;
  response_breaches: number;
  resolution_breaches: number;
}

/**
 * GET .../dashboard/escalation-metrics/
 * Matches EscalationMetricsSerializer exactly. `by_level` is a dynamic map of
 * escalation level (as string) -> active escalation count at that level.
 */
export interface EscalationMetrics {
  active: number;
  completed: number;
  cancelled: number;
  by_level: Record<string, number>;
}

/**
 * A single incident row from GET .../dashboard/incidents/.
 * Matches DashboardIncidentSerializer exactly (read-optimized projection, not
 * the full Incident model).
 */
export interface DashboardIncident {
  id: string;
  incident_number: string;
  title: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  assignee_email: string | null;
  sla_state: DashboardSlaState;
  escalation_status: DashboardEscalationStatus;
  created_at: string;
}

/**
 * Standard DRF PageNumberPagination envelope for the dashboard incidents
 * endpoint. DashboardPagination extends PageNumberPagination without a custom
 * get_paginated_response, so the default {count,next,previous,results} shape
 * applies (confirmed against config DEFAULT_PAGINATION_CLASS).
 */
export interface DashboardIncidentPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: DashboardIncident[];
}

/**
 * Query parameters supported by GET .../dashboard/incidents/
 * as documented by DashboardIncidentListView.
 */
export interface DashboardIncidentParams {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assignee_id?: string;
  sla_state?: Exclude<DashboardSlaState, 'UNKNOWN'>;
  escalation_state?: Exclude<DashboardEscalationStatus, null>;
  page?: number;
  page_size?: number;
  ordering?: string;
}
