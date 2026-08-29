/**
 * Operations Dashboard service for PulseDesk (Phase 13.9).
 *
 * Handles all Operations Command Center API calls using the existing shared
 * API client (api). Based on the backend contract in backend/apps/dashboard/.
 *
 * All endpoints are organization-scoped and mounted under:
 *   /api/v1/organizations/<organization_id>/dashboard/
 *
 * Every request requires the `incident.view` permission (CanViewDashboard) and
 * membership of the target organization (IsOrganizationMember). No organization
 * IDs, incident IDs, statistics, or URLs are hard-coded.
 */

import { api } from '../../../api/client';
import type {
  DashboardSummary,
  PriorityDistribution,
  SlaMetrics,
  EscalationMetrics,
  DashboardIncidentPage,
  DashboardIncidentParams,
} from '../types/operations.types';

/**
 * Build the organization-scoped base URL for dashboard endpoints.
 */
function getDashboardBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/dashboard`;
}

/**
 * GET .../dashboard/summary/
 * High-level aggregate counts for the operations dashboard.
 */
export async function getDashboardSummary(
  organizationId: string
): Promise<DashboardSummary> {
  return api.get<DashboardSummary>(`${getDashboardBaseUrl(organizationId)}/summary/`);
}

/**
 * GET .../dashboard/priority-distribution/
 * Incident counts grouped by priority (low/medium/high/critical).
 */
export async function getPriorityDistribution(
  organizationId: string
): Promise<PriorityDistribution> {
  return api.get<PriorityDistribution>(
    `${getDashboardBaseUrl(organizationId)}/priority-distribution/`
  );
}

/**
 * GET .../dashboard/sla-metrics/
 * Detailed SLA performance metrics.
 */
export async function getSlaMetrics(organizationId: string): Promise<SlaMetrics> {
  return api.get<SlaMetrics>(`${getDashboardBaseUrl(organizationId)}/sla-metrics/`);
}

/**
 * GET .../dashboard/escalation-metrics/
 * Aggregate escalation counts by status plus active by-level distribution.
 */
export async function getEscalationMetrics(
  organizationId: string
): Promise<EscalationMetrics> {
  return api.get<EscalationMetrics>(
    `${getDashboardBaseUrl(organizationId)}/escalation-metrics/`
  );
}

/**
 * GET .../dashboard/incidents/
 * Read-optimized, filterable, paginated incident list for operational
 * oversight. Undefined params are omitted by axios so the backend applies its
 * defaults (ordering=-created_at, page_size=50).
 */
export async function getDashboardIncidents(
  organizationId: string,
  params?: DashboardIncidentParams
): Promise<DashboardIncidentPage> {
  return api.get<DashboardIncidentPage>(
    `${getDashboardBaseUrl(organizationId)}/incidents/`,
    { params }
  );
}
