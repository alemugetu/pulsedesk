/**
 * React hook for the Operations Command Center SLA metrics.
 *
 * Fetches GET /api/v1/organizations/<organization_id>/dashboard/sla-metrics/.
 * Organization-scoped query key for tenant isolation.
 * Reuses the backend SLA metrics — no SLA business logic is recreated here.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getSlaMetrics } from '../services/operationsService';
import type { SlaMetrics } from '../types/operations.types';

/**
 * Query key factory for the dashboard SLA metrics.
 * Scoped by organization — switching organizations yields a distinct key.
 */
export function getOperationsSlaQueryKey(
  organizationId: string | null
): readonly [string, string | null, string] {
  return ['operations', organizationId, 'sla-metrics'] as const;
}

/**
 * Hook to fetch SLA metrics for the current organization.
 *
 * @returns TanStack Query result with SlaMetrics data.
 */
export function useOperationsSla() {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsSlaQueryKey(organization?.id ?? null);

  return useQuery<SlaMetrics>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getSlaMetrics(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}