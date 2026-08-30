import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getEscalationActivity } from '../services/reportService';
import type { EscalationActivityResponse, ReportsDateRange } from '../types/report.types';

export function getEscalationReportsQueryKey(
  organizationId: string | null,
  suffix: string
): readonly [string, string | null, string, string] {
  return ['reports', organizationId, 'escalations', suffix] as const;
}

export function useEscalationActivity(
  dateRange?: ReportsDateRange
): UseQueryResult<EscalationActivityResponse, Error> {
  const organization = useCurrentOrganization();
  const queryKey = getEscalationReportsQueryKey(organization?.id ?? null, 'activity');

  return useQuery<EscalationActivityResponse, Error>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getEscalationActivity(organization.id, dateRange);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

