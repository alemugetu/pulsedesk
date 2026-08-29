/**
 * React hook for fetching escalation policies list.
 * 
 * Provides TanStack Query integration for escalation policy list with filtering.
 * Properly scoped to organization context for tenant isolation.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getEscalationPolicies } from '../services/escalationService';

/**
 * Query key factory for escalation policy list queries
 * Scoped by organization for tenant isolation
 */
export function getEscalationPoliciesQueryKey(organizationId: string | null, isActive?: boolean) {
  return ['escalation-policies', organizationId, isActive] as const;
}

/**
 * Hook to fetch escalation policies list
 * 
 * @param isActive - Optional filter by active status
 * @returns TanStack Query result with escalation policy list data
 */
export function useEscalationPolicies(isActive?: boolean) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getEscalationPoliciesQueryKey(organization?.id || null, isActive);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getEscalationPolicies(organization.id, { is_active: isActive });
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Invalidate escalation policy list query
   * Useful after mutations (create, update, delete)
   */
  const invalidateEscalationPolicies = () => {
    if (organization?.id) {
      queryClient.invalidateQueries({
        queryKey: ['escalation-policies', organization.id],
      });
    }
  };

  return {
    ...query,
    invalidateEscalationPolicies,
  };
}
