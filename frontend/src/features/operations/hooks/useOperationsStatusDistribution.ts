/**
 * React hook for the Operations Command Center incident status distribution.
 *
 * The backend does not expose a status-distribution endpoint, so this derives
 * exact per-status totals from the authoritative dashboard incidents API
 * (see operationsService.getIncidentStatusDistribution). All values originate
 * from the backend — nothing is fabricated client-side.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getIncidentStatusDistribution } from '../services/operationsService';
import type { IncidentStatusDistribution } from '../types/operations.types';

/**
 * Query key factory for the incident status distribution.
 * Scoped by organization — switching organizations yields a distinct key.
 */
export function getOperationsStatusDistributionQueryKey(
  organizationId: string | null
): readonly [string, string | null, string] {
  return ['operations', organizationId, 'status-distribution'] as const;
}

/**
 * Hook to fetch the incident status distribution for the current organization.
 *
 * @returns TanStack Query result with IncidentStatusDistribution data.
 */
export function useOperationsStatusDistribution() {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsStatusDistributionQueryKey(organization?.id ?? null);

  return useQuery<IncidentStatusDistribution>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentStatusDistribution(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}