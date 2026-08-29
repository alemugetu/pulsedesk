/**
 * React hook for the Operations Command Center summary.
 *
 * Fetches GET /api/v1/organizations/<organization_id>/dashboard/summary/.
 * Organization-scoped query key for tenant isolation.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getOperationsSummary } from '../services/operationsService';
import type { OperationsSummary } from '../types/operations.types';

/**
 * Query key factory for the dashboard summary.
 * Scoped by organization — switching organizations yields a distinct key and
 * therefore a fresh, tenant-correct fetch.
 */
export function getOperationsSummaryQueryKey(
  organizationId: string | null
): readonly [string, string | null, string] {
  return ['operations', organizationId, 'summary'] as const;
}

/**
 * Hook to fetch the operational summary for the current organization.
 *
 * @returns TanStack Query result with OperationsSummary data.
 */
export function useOperationsSummary() {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsSummaryQueryKey(organization?.id ?? null);

  return useQuery<OperationsSummary>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getOperationsSummary(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}