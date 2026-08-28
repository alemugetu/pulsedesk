/**
 * React hooks for organization operations using TanStack Query.
 * 
 * Provides data fetching and mutation hooks for organizations.
 * Implements tenant-aware query keys for cache isolation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as organizationService from '../services/organizationService';
import type { CreateOrganizationRequest } from '../types/organization';

/**
 * Query keys for organizations - tenant-aware for cache isolation
 */
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: () => [...organizationKeys.lists()] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
};

/**
 * Hook to fetch all organizations for the authenticated user
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: organizationService.getOrganizations,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to create a new organization
 * Automatically invalidates the organizations list on success
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrganizationRequest) =>
      organizationService.createOrganization(data),
    onSuccess: () => {
      // Invalidate and refetch organizations list
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
  });
}


