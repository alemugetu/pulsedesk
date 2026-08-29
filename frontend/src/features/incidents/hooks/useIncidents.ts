/**
 * React hook for fetching incidents list.
 * 
 * Provides TanStack Query integration for incident list with filtering and pagination.
 * Properly scoped to organization context for tenant isolation.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getIncidents } from '../services/incidentService';
import type { IncidentFilters } from '../types/incident.types';

/**
 * Query key factory for incident list queries
 * Scoped by organization for tenant isolation
 */
export function getIncidentsQueryKey(organizationId: string | null, filters?: IncidentFilters) {
  return ['incidents', organizationId, filters] as const;
}

/**
 * Hook to fetch incidents list
 * 
 * @param filters - Optional filter parameters for search, status, priority, etc.
 * @returns TanStack Query result with incident list data
 */
export function useIncidents(filters?: IncidentFilters) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getIncidentsQueryKey(organization?.id || null, filters);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidents(organization.id, filters);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Invalidate incident list query
   * Useful after mutations (create, update, delete)
   */
  const invalidateIncidents = () => {
    if (organization?.id) {
      queryClient.invalidateQueries({
        queryKey: ['incidents', organization.id],
      });
    }
  };

  return {
    ...query,
    invalidateIncidents,
  };
}
