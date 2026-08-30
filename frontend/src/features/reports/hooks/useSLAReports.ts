import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import {
  getAverageResolutionTime,
  getSLAPerformance,
} from '../services/reportService';
import type {
  AverageResolutionTimeResponse,
  ReportsDateRange,
  SLAPerformanceResponse,
} from '../types/report.types';

export function getSLAReportsQueryKey(
  organizationId: string | null,
  suffix: string
): readonly [string, string | null, string, string] {
  return ['reports', organizationId, 'sla', suffix] as const;
}

export function useSLAPerformance(
  dateRange?: ReportsDateRange
): UseQueryResult<SLAPerformanceResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getSLAReportsQueryKey(organization?.id ?? null, 'performance');

  return useQuery<SLAPerformanceResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getSLAPerformance(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useAverageResolutionTime(
  dateRange?: ReportsDateRange
): UseQueryResult<AverageResolutionTimeResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getSLAReportsQueryKey(organization?.id ?? null, 'resolution-time');

  return useQuery<AverageResolutionTimeResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getAverageResolutionTime(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

