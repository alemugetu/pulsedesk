import { api } from '../../../api/client';
import type {
  AverageResolutionTimeResponse,
  EscalationActivityResponse,
  IncidentSummaryResponse,
  IncidentTrendResponse,
  IncidentsByCategoryResponse,
  IncidentsByPriorityResponse,
  IncidentsByStatusResponse,
  ReportsDateRange,
  SLAPerformanceResponse,
  TrendGranularity,
} from '../types/report.types';

function getReportsBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/reports`;
}

export async function getIncidentSummary(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<IncidentSummaryResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/summary/`;
  return api.get<IncidentSummaryResponse>(url, { params: dateRange });
}

export async function getIncidentsByStatus(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<IncidentsByStatusResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/incidents/by-status/`;
  return api.get<IncidentsByStatusResponse>(url, { params: dateRange });
}

export async function getIncidentsByPriority(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<IncidentsByPriorityResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/incidents/by-priority/`;
  return api.get<IncidentsByPriorityResponse>(url, { params: dateRange });
}

export async function getIncidentsByCategory(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<IncidentsByCategoryResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/incidents/by-category/`;
  return api.get<IncidentsByCategoryResponse>(url, { params: dateRange });
}

export async function getIncidentTrend(
  organizationId: string,
  dateRange: ReportsDateRange,
  granularity: TrendGranularity = 'daily'
): Promise<IncidentTrendResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/incidents/trend/`;
  return api.get<IncidentTrendResponse>(url, { params: { ...dateRange, granularity } });
}

export async function getSLAPerformance(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<SLAPerformanceResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/sla/`;
  return api.get<SLAPerformanceResponse>(url, { params: dateRange });
}

export async function getAverageResolutionTime(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<AverageResolutionTimeResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/resolution-time/`;
  return api.get<AverageResolutionTimeResponse>(url, { params: dateRange });
}

export async function getEscalationActivity(
  organizationId: string,
  dateRange?: ReportsDateRange
): Promise<EscalationActivityResponse> {
  const url = `${getReportsBaseUrl(organizationId)}/escalations/`;
  return api.get<EscalationActivityResponse>(url, { params: dateRange });
}

