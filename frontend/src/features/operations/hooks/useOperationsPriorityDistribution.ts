/**
 * React hook for the Operations Command Center priority distribution.
 *
 * Fetches GET /api/v1/organizations/<organization_id>/dashboard/priority-distribution/.
 * Organization-scoped query key for tenant isolation.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getPriorityDistribution } from '../services/operationsService';
import type { PriorityDistribution } from '../types/operations.types';

/**
 * Query key factory for the dashboard priority distribution.
 * Scoped by organization — switching organizations yields a distinct key.
 */
export function getOperationsPriorityDistributionQueryKey(
  organizationId: string | null
): readonly [string, string | null, string] {
  return ['operations', organizationId, 'priority-distribution'] as const;
}

/**
 * Hook to fetch the incident priority distribution for the current organization.
 *
 * @returns TanStack Query result with PriorityDistribution data.
 */
export function useOperationsPriorityDistribution() {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsPriorityDistributionQueryKey(organization?.id ?? null);

  return useQuery<PriorityDistribution>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getPriorityDistribution(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}