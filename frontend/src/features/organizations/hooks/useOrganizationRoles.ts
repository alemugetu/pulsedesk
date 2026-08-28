/**
 * React hooks for organization role operations using TanStack Query.
 * 
 * Provides data fetching and mutation hooks for organization roles.
 * Implements tenant-aware query keys for cache isolation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as roleService from '../services/roleService';
import type { CreateRoleRequest, UpdateRoleRequest } from '../types/role';

/**
 * Query keys for organization roles - tenant-aware for cache isolation
 */
export const roleKeys = {
  all: (organizationId: string) => ['organizations', organizationId, 'roles'] as const,
  lists: (organizationId: string) => [...roleKeys.all(organizationId), 'list'] as const,
  list: (organizationId: string) => [...roleKeys.lists(organizationId)] as const,
  details: (organizationId: string) => [...roleKeys.all(organizationId), 'detail'] as const,
  detail: (organizationId: string, roleId: string) =>
    [...roleKeys.details(organizationId), roleId] as const,
};

/**
 * Hook to fetch all roles in an organization
 * Requires organization ID for tenant-aware caching
 */
export function useOrganizationRoles(organizationId: string) {
  return useQuery({
    queryKey: roleKeys.list(organizationId),
    queryFn: () => roleService.getOrganizationRoles(organizationId),
    enabled: !!organizationId, // Only run if organizationId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a custom role
 * Automatically invalidates the roles list on success
 */
export function useCreateRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) =>
      roleService.createRole(organizationId, data),
    onSuccess: () => {
      // Invalidate and refetch roles list for this organization
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(organizationId) });
    },
  });
}

/**
 * Hook to update a role
 * Automatically invalidates the roles list and role detail on success
 */
export function useUpdateRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: UpdateRoleRequest }) =>
      roleService.updateRole(organizationId, roleId, data),
    onSuccess: (_, variables) => {
      // Invalidate and refetch roles list and specific role detail
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(organizationId) });
      queryClient.invalidateQueries({ 
        queryKey: roleKeys.detail(organizationId, variables.roleId) 
      });
    },
  });
}

/**
 * Hook to delete a custom role
 * Automatically invalidates the roles list on success
 */
export function useDeleteRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) => roleService.deleteRole(organizationId, roleId),
    onSuccess: () => {
      // Invalidate and refetch roles list for this organization
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(organizationId) });
    },
  });
}
