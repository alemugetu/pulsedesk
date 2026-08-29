/**
 * React hook for fetching SLA policies list.
 * 
 * Provides TanStack Query integration for SLA policy list with filtering.
 * Properly scoped to organization context for tenant isolation.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getSlaPolicies } from '../services/slaService';

/**
 * Query key factory for SLA policy list queries
 * Scoped by organization for tenant isolation
 */
export function getSlaPoliciesQueryKey(organizationId: string | null, isActive?: boolean) {
  return ['sla-policies', organizationId, isActive] as const;
}

/**
 * Hook to fetch SLA policies list
 * 
 * @param isActive - Optional filter by active status
 * @returns TanStack Query result with SLA policy list data
 */
export function useSlaPolicies(isActive?: boolean) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getSlaPoliciesQueryKey(organization?.id || null, isActive);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getSlaPolicies(organization.id, { is_active: isActive });
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Invalidate SLA policy list query
   * Useful after mutations (create, update, delete)
   */
  const invalidateSlaPolicies = () => {
    if (organization?.id) {
      queryClient.invalidateQueries({
        queryKey: ['sla-policies', organization.id],
      });
    }
  };

  return {
    ...query,
    invalidateSlaPolicies,
  };
}
