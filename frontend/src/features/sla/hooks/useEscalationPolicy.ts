/**
 * React hook for fetching a single escalation policy.
 * 
 * Provides TanStack Query integration for escalation policy detail.
 * Properly scoped to organization context for tenant isolation.
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getEscalationPolicy, updateEscalationPolicy } from '../services/escalationService';
import type { EscalationPolicyUpdateRequest } from '../types/escalation.types';

/**
 * Query key factory for escalation policy detail queries
 * Scoped by organization and policy ID for tenant isolation
 */
export function getEscalationPolicyQueryKey(organizationId: string | null, policyId: string | null) {
  return ['escalation-policy', organizationId, policyId] as const;
}

/**
 * Hook to fetch a single escalation policy
 * 
 * @param policyId - The escalation policy ID
 * @returns TanStack Query result with escalation policy data
 */
export function useEscalationPolicy(policyId: string | null) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getEscalationPolicyQueryKey(organization?.id || null, policyId);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id || !policyId) {
        throw new Error('Organization context and policy ID are required');
      }
      return getEscalationPolicy(organization.id, policyId);
    },
    enabled: !!organization?.id && !!policyId,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Update escalation policy mutation
   */
  const updateMutation = useMutation({
    mutationFn: (data: EscalationPolicyUpdateRequest) => {
      if (!organization?.id || !policyId) {
        throw new Error('Organization context and policy ID are required');
      }
      return updateEscalationPolicy(organization.id, policyId, data);
    },
    onSuccess: () => {
      // Invalidate this policy query
      if (organization?.id && policyId) {
        queryClient.invalidateQueries({
          queryKey: getEscalationPolicyQueryKey(organization.id, policyId),
        });
      }
      // Invalidate policy list
      if (organization?.id) {
        queryClient.invalidateQueries({
          queryKey: ['escalation-policies', organization.id],
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
