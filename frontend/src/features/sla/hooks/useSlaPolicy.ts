/**
 * React hook for fetching a single SLA policy.
 * 
 * Provides TanStack Query integration for SLA policy detail.
 * Properly scoped to organization context for tenant isolation.
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getSlaPolicy, updateSlaPolicy } from '../services/slaService';
import type { SLAPolicyUpdateRequest } from '../types/sla.types';

/**
 * Query key factory for SLA policy detail queries
 * Scoped by organization and policy ID for tenant isolation
 */
export function getSlaPolicyQueryKey(organizationId: string | null, policyId: string | null) {
  return ['sla-policy', organizationId, policyId] as const;
}

/**
 * Hook to fetch a single SLA policy
 * 
 * @param policyId - The SLA policy ID
 * @returns TanStack Query result with SLA policy data
 */
export function useSlaPolicy(policyId: string | null) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getSlaPolicyQueryKey(organization?.id || null, policyId);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id || !policyId) {
        throw new Error('Organization context and policy ID are required');
      }
      return getSlaPolicy(organization.id, policyId);
    },
    enabled: !!organization?.id && !!policyId,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Update SLA policy mutation
   */
  const updateMutation = useMutation({
    mutationFn: (data: SLAPolicyUpdateRequest) => {
      if (!organization?.id || !policyId) {
        throw new Error('Organization context and policy ID are required');
      }
      return updateSlaPolicy(organization.id, policyId, data);
    },
    onSuccess: () => {
      // Invalidate this policy query
      if (organization?.id && policyId) {
        queryClient.invalidateQueries({
          queryKey: getSlaPolicyQueryKey(organization.id, policyId),
        });
      }
      // Invalidate policy list
      if (organization?.id) {
        queryClient.invalidateQueries({
          queryKey: ['sla-policies', organization.id],
        });
      }
    },
  });

  return {
    ...query,
    updatePolicy: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
