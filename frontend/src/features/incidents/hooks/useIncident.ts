/**
 * React hook for fetching a single incident.
 * 
 * Provides TanStack Query integration for incident detail.
 * Properly scoped to organization context for tenant isolation.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getIncident } from '../services/incidentService';

/**
 * Query key factory for single incident queries
 * Scoped by organization for tenant isolation
 */
export function getIncidentQueryKey(organizationId: string | null, incidentId: string | null) {
  return ['incident', organizationId, incidentId] as const;
}

/**
 * Hook to fetch a single incident by ID
 * 
 * @param incidentId - The UUID of the incident to fetch
 * @returns TanStack Query result with incident data
 */
export function useIncident(incidentId: string | null) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getIncidentQueryKey(organization?.id || null, incidentId);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      if (!incidentId) {
        throw new Error('Incident ID is required');
      }
      return getIncident(organization.id, incidentId);
    },
    enabled: !!organization?.id && !!incidentId,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  /**
   * Invalidate incident detail query
   * Useful after updates or status transitions
   */
  const invalidateIncident = () => {
    if (organization?.id && incidentId) {
      queryClient.invalidateQueries({
        queryKey: ['incident', organization.id, incidentId],
      });
    }
  };

  return {
    ...query,
    invalidateIncident,
  };
}
