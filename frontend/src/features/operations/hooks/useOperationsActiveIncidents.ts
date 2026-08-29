/**
 * React hook for the Operations Command Center active incidents.
 *
 * The backend dashboard incidents view accepts a single status filter, so
 * active incidents (OPEN, ACKNOWLEDGED, IN_PROGRESS) are composed from the
 * real API — see operationsService.getOperationsActiveIncidents.
 * All displayed incidents originate from the backend.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getOperationsActiveIncidents } from '../services/operationsService';
import type { DashboardIncident } from '../types/operations.types';

/**
 * Query key factory for active incidents.
 * Scoped by organization — switching organizations yields a distinct key.
 */
export function getOperationsActiveIncidentsQueryKey(
  organizationId: string | null
): readonly [string, string | null, string] {
  return ['operations', organizationId, 'active-incidents'] as const;
}

/**
 * Hook to fetch the most recently created active incidents for the current
 * organization.
 *
 * @param limit - Maximum number of active incidents to return.
 * @returns TanStack Query result with DashboardIncident[].
 */
export function useOperationsActiveIncidents(limit = 5) {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsActiveIncidentsQueryKey(organization?.id ?? null);

  return useQuery<DashboardIncident[]>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getOperationsActiveIncidents(organization.id, limit);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}