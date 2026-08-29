/**
 * Operations service for PulseDesk.
 *
 * Handles all Operations Command Center API calls using the existing API client.
 * Based on the backend Operations Dashboard API contract in backend/apps/dashboard/.
 *
 * Endpoints:
 * - GET /api/v1/organizations/<organization_id>/dashboard/summary/
 * - GET /api/v1/organizations/<organization_id>/dashboard/priority-distribution/
 * - GET /api/v1/organizations/<organization_id>/dashboard/sla-metrics/
 * - GET /api/v1/organizations/<organization_id>/dashboard/escalation-metrics/
 * - GET /api/v1/organizations/<organization_id>/dashboard/incidents/
 *
 * Every call is organization-scoped. All requests go through the shared
 * API client (no second client/axios instance).
 */

import { api } from '../../../api/client';
import type { IncidentStatus } from '../../incidents/types/incident.types';
import type {
  DashboardIncident,
  DashboardIncidentListResponse,
  EscalationMetrics,
  IncidentStatusDistribution,
  OperationsIncidentFilters,
  OperationsSummary,
  PriorityDistribution,
  SlaMetrics,
} from '../types/operations.types';

/**
 * Build the organization-scoped dashboard base URL.
 */
function getDashboardBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/dashboard`;
}

/**
 * Get the high-level operational summary.
 * GET /api/v1/organizations/<organization_id>/dashboard/summary/
 */
export async function getOperationsSummary(
  organizationId: string
): Promise<OperationsSummary> {
  const url = `${getDashboardBaseUrl(organizationId)}/summary/`;
  return api.get<OperationsSummary>(url);
}

/**
 * Get incident counts grouped by priority.
 * GET /api/v1/organizations/<organization_id>/dashboard/priority-distribution/
 */
export async function getPriorityDistribution(
  organizationId: string
): Promise<PriorityDistribution> {
  const url = `${getDashboardBaseUrl(organizationId)}/priority-distribution/`;
  return api.get<PriorityDistribution>(url);
}

/**
 * Get detailed SLA performance metrics.
 * GET /api/v1/organizations/<organization_id>/dashboard/sla-metrics/
 */
export async function getSlaMetrics(organizationId: string): Promise<SlaMetrics> {
  const url = `${getDashboardBaseUrl(organizationId)}/sla-metrics/`;
  return api.get<SlaMetrics>(url);
}

/**
 * Get escalation metrics.
 * GET /api/v1/organizations/<organization_id>/dashboard/escalation-metrics/
 */
export async function getEscalationMetrics(
  organizationId: string
): Promise<EscalationMetrics> {
  const url = `${getDashboardBaseUrl(organizationId)}/escalation-metrics/`;
  return api.get<EscalationMetrics>(url);
}

/**
 * Get a read-optimized, filterable paginated incident list.
 * GET /api/v1/organizations/<organization_id>/dashboard/incidents/
 *
 * Query parameters (backend-supported):
 * - status: OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED
 * - priority: P1, P2, P3, P4
 * - assignee_id: membership UUID
 * - sla_state: HEALTHY, AT_RISK, BREACHED
 * - escalation_state: ACTIVE, COMPLETED, CANCELLED
 * - ordering: created_at, priority, status, id (prefix with - for descending)
 * - page / page_size (max 500)
 */
export async function getDashboardIncidents(
  organizationId: string,
  params?: OperationsIncidentFilters
): Promise<DashboardIncidentListResponse> {
  const url = `${getDashboardBaseUrl(organizationId)}/incidents/`;
  return api.get<DashboardIncidentListResponse>(url, { params });
}

/**
 * Statuses considered "active" by the backend operations model.
 * Source of truth: dashboard.selectors.get_dashboard_summary open_statuses.
 */
export const ACTIVE_INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
];

/**
 * Get the most recently created active incidents.
 *
 * The backend dashboard incidents view accepts a single status filter, so we
 * compose one request per active status and merge the results. Every displayed
 * incident originates from the real backend API — no client-side fabrication.
 *
 * @param limit - maximum number of active incidents to return
 */
export async function getOperationsActiveIncidents(
  organizationId: string,
  limit = 5
): Promise<DashboardIncident[]> {
  const responses = await Promise.all(
    ACTIVE_INCIDENT_STATUSES.map((status) =>
      getDashboardIncidents(organizationId, {
        status,
        ordering: '-created_at',
        page_size: limit,
      })
    )
  );

  const merged = responses.flatMap((response) => response.results);
  return merged
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

/**
 * Get the incident distribution by status.
 *
 * The backend does not expose a status-distribution endpoint. We derive exact
 * per-status totals from the authoritative dashboard incidents API using the
 * documented `status` filter with page_size=1 (each response `count` is the
 * true total). No dates, totals, or proportions are invented.
 */
export async function getIncidentStatusDistribution(
  organizationId: string
): Promise<IncidentStatusDistribution> {
  const statuses: readonly IncidentStatus[] = [
    'OPEN',
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
  ];

  const responses = await Promise.all(
    statuses.map((status) =>
      getDashboardIncidents(organizationId, { status, page_size: 1 })
    )
  );

  const distribution = {} as IncidentStatusDistribution;
  statuses.forEach((status, index) => {
    distribution[status] = responses[index].count;
  });

  return distribution;
}