/**
 * React hooks for organization membership operations using TanStack Query.
 * 
 * Provides data fetching and mutation hooks for organization members.
 * Implements tenant-aware query keys for cache isolation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as memberService from '../services/memberService';
import type { MembershipRoleAssignRequest } from '../types/membership';

/**
 * Query keys for organization members - tenant-aware for cache isolation
 */
export const memberKeys = {
  all: (organizationId: string) => ['organizations', organizationId, 'members'] as const,
  lists: (organizationId: string) => [...memberKeys.all(organizationId), 'list'] as const,
  list: (organizationId: string) => [...memberKeys.lists(organizationId)] as const,
  detail: (organizationId: string, membershipId: string) =>
    [...memberKeys.all(organizationId), 'detail', membershipId] as const,
};

/**
 * Hook to fetch all members of an organization
 * Requires organization ID for tenant-aware caching
 */
export function useOrganizationMembers(organizationId: string) {
  return useQuery({
    queryKey: memberKeys.list(organizationId),
    queryFn: () => memberService.getOrganizationMembers(organizationId),
    enabled: !!organizationId, // Only run if organizationId is provided
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Hook to assign a role to a membership
 * Automatically invalidates the members list on success
 */
export function useAssignMembershipRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ membershipId, data }: { membershipId: string; data: MembershipRoleAssignRequest }) =>
      memberService.assignMembershipRole(organizationId, membershipId, data),
    onSuccess: () => {
      // Invalidate and refetch members list for this organization
      queryClient.invalidateQueries({ queryKey: memberKeys.lists(organizationId) });
    },
  });
}
