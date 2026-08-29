/**
 * React hook for updating incidents.
 * 
 * Provides TanStack Query mutation integration for incident updates.
 * Handles field updates, assignment changes, and status transitions.
 * Properly scoped to organization context for tenant isolation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { updateIncident } from '../services/incidentService';
import type { UpdateIncidentRequest } from '../types/incident.types';

/**
 * Hook to update an incident
 * 
 * @returns TanStack Query mutation for incident updates
 */
export function useUpdateIncident() {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ incidentId, data }: { incidentId: string; data: UpdateIncidentRequest }) => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return updateIncident(organization.id, incidentId, data);
    },
    onSuccess: (_data, variables: { incidentId: string; data: UpdateIncidentRequest }) => {
      // Invalidate both the specific incident and the incident list
      if (organization?.id) {
        queryClient.invalidateQueries({
          queryKey: ['incident', organization.id, variables.incidentId],
        });
        queryClient.invalidateQueries({
          queryKey: ['incidents', organization.id],
        });
      }
    },
  });

  return {
    ...mutation,
    updateIncident: mutation.mutate,
    updateIncidentAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}
