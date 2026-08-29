/**
 * React hook for creating incidents.
 * 
 * Provides TanStack Query mutation integration for incident creation.
 * Properly scoped to organization context for tenant isolation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { createIncident } from '../services/incidentService';
import type { CreateIncidentRequest } from '../types/incident.types';

/**
 * Hook to create a new incident
 * 
 * @returns TanStack Query mutation for incident creation
 */
export function useCreateIncident() {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateIncidentRequest) => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return createIncident(organization.id, data);
    },
    onSuccess: () => {
      // Invalidate incident list to show the new incident
      if (organization?.id) {
        queryClient.invalidateQueries({
          queryKey: ['incidents', organization.id],
        });
      }
    },
  });

  return {
    ...mutation,
    createIncident: mutation.mutate,
    createIncidentAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}
