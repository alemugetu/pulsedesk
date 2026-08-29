/**
 * Operations Command Center types for PulseDesk.
 *
 * Strict TypeScript models matching the backend Operations Dashboard API contract.
 * Authority: backend/apps/dashboard/ (Phase 11) — serializers, selectors, views,
 * and backend/schema.yml.
 *
 * Endpoints:
 * - GET /api/v1/organizations/<organization_id>/dashboard/summary/
 * - GET /api/v1/organizations/<organization_id>/dashboard/priority-distribution/
 * - GET /api/v1/organizations/<organization_id>/dashboard/sla-metrics/
 * - GET /api/v1/organizations/<organization_id>/dashboard/escalation-metrics/
 * - GET /api/v1/organizations/<organization_id>/dashboard/incidents/
 *
 * Only fields that actually exist on the backend responses are represented.
 */

import type { IncidentStatus, IncidentPriority } from '../../incidents/types/incident.types';
import type { EscalationStatus } from '../../sla/types/escalation.types';

/**
 * SLA state derived by the backend for a dashboard incident.
 * NOTE: distinct from Phase 13.8 SLAStatus (ON_TRACK/BREACHED/COMPLETED).
 * The backend derives HEALTHY/AT_RISK/BREACHED here and returns UNKNOWN when
 * no SLA record is attached.
 */
export type DashboardSlaState = 'HEALTHY' | 'AT_RISK' | 'BREACHED' | 'UNKNOWN';

/**
 * Escalation status of the most recent escalation on a dashboard incident.
 * null when the incident has no escalations.
 */
export type DashboardEscalationState = EscalationStatus | null;

/**
 * High-level operational summary (GET .../dashboard/summary/).
 * Matches DashboardSummarySerializer.
 */
export interface OperationsSummary {
  open_incidents: number;
  unassigned_incidents: number;
  sla_at_risk: number;
  sla_breached: number;
  active_escalations: number;
}

/**
 * Incident counts grouped by priority (GET .../dashboard/priority-distribution/).
 * Matches PriorityDistributionSerializer: low=P4, medium=P3, high=P2, critical=P1.
 */
export interface PriorityDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/**
 * Detailed SLA metrics (GET .../dashboard/sla-metrics/).
 * Matches SLAMetricsSerializer.
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
 * Escalation metrics (GET .../dashboard/escalation-metrics/).
 * Matches EscalationMetricsSerializer. by_level maps level number (string key)
 * to the count of active escalations at that level.
 */
export interface EscalationMetrics {
  active: number;
  completed: number;
  cancelled: number;
  by_level: Record<string, number>;
}

/**
 * Read-optimized incident row returned by the dashboard incidents view.
 * Matches DashboardIncidentSerializer.
 */
export interface DashboardIncident {
  id: string;
  incident_number: string;
  title: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  assignee_email: string | null;
  sla_state: DashboardSlaState;
  escalation_status: DashboardEscalationState;
  created_at: string;
}

/**
 * Paginated dashboard incident list response.
 * Matches DashboardPagination (PageNumberPagination) output.
 */
export interface DashboardIncidentListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DashboardIncident[];
}

/**
 * Filter parameters supported by GET .../dashboard/incidents/.
 */
export interface OperationsIncidentFilters {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assignee_id?: string;
  sla_state?: DashboardSlaState;
  escalation_state?: EscalationStatus;
  ordering?: string;
  page?: number;
  page_size?: number;
}

/**
 * Incident distribution by status.
 * Built client-side from count responses of the real dashboard incidents API
 * (one page_size=1 request per status). Every value originates from the backend.
 */
export type IncidentStatusDistribution = Record<IncidentStatus, number>;