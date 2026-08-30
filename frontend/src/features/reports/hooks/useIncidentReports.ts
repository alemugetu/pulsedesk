import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import {
  getIncidentSummary,
  getIncidentsByCategory,
  getIncidentsByPriority,
  getIncidentsByStatus,
  getIncidentTrend,
} from '../services/reportService';
import type {
  IncidentSummaryResponse,
  IncidentsByCategoryResponse,
  IncidentsByPriorityResponse,
  IncidentsByStatusResponse,
  IncidentTrendResponse,
  ReportsDateRange,
  TrendGranularity,
} from '../types/report.types';

export function getIncidentReportsQueryKey(
  organizationId: string | null,
  suffix: string
): readonly [string, string | null, string, string] {
  return ['reports', organizationId, 'incidents', suffix] as const;
}

export function useIncidentSummary(
  dateRange?: ReportsDateRange
): UseQueryResult<IncidentSummaryResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getIncidentReportsQueryKey(organization?.id ?? null, 'summary');

  return useQuery<IncidentSummaryResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentSummary(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useIncidentsByStatus(
  dateRange?: ReportsDateRange
): UseQueryResult<IncidentsByStatusResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getIncidentReportsQueryKey(organization?.id ?? null, 'by-status');

  return useQuery<IncidentsByStatusResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentsByStatus(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useIncidentsByPriority(
  dateRange?: ReportsDateRange
): UseQueryResult<IncidentsByPriorityResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getIncidentReportsQueryKey(organization?.id ?? null, 'by-priority');

  return useQuery<IncidentsByPriorityResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentsByPriority(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useIncidentsByCategory(
  dateRange?: ReportsDateRange
): UseQueryResult<IncidentsByCategoryResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getIncidentReportsQueryKey(organization?.id ?? null, 'by-category');

  return useQuery<IncidentsByCategoryResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentsByCategory(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useIncidentTrend(
  dateRange: ReportsDateRange,
  granularity: TrendGranularity = 'daily'
): UseQueryResult<IncidentTrendResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getIncidentReportsQueryKey(
    organization?.id ?? null,
    `trend-${granularity}`
  );

  return useQuery<IncidentTrendResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentTrend(organization.id, dateRange, granularity);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

