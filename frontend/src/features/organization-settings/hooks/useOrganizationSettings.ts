/**
 * React hook for organization settings.
 * 
 * Provides TanStack Query integration for organization settings with
 * proper tenant isolation via organization context.
 * 
 * Backend permissions:
 * - GET: settings.view
 * - PATCH: settings.manage
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from '../services/organizationSettingsService';
import type {
  OrganizationSettingsUpdateRequest,
} from '../types/organizationSettings.types';

/**
 * Query key factory for organization settings queries
 * Scoped by organization for tenant isolation
 */
export function getOrganizationSettingsQueryKey(organizationId: string | null) {
  return ['organization-settings', organizationId] as const;
}

/**
 * Hook to fetch organization settings
 * 
 * @returns TanStack Query result with organization settings data
 * 
 * Behavior:
 * - Does not fetch without an active organization
 * - Includes organization ID in query key for tenant isolation
 * - Automatically refetches when organization changes
 */
export function useOrganizationSettings() {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getOrganizationSettingsQueryKey(organization?.id || null);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getOrganizationSettings(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  /**
   * Update organization settings mutation
   */
  const updateMutation = useMutation({
    mutationFn: (data: OrganizationSettingsUpdateRequest) => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return updateOrganizationSettings(organization.id, data);
    },
    onSuccess: (updatedSettings) => {
      // Update the cache with the new data from server
      queryClient.setQueryData(queryKey, updatedSettings);
    },
  });

  /**
   * Invalidate organization settings query
   * Useful for manual refresh or after external changes
   */
  const invalidateSettings = () => {
    if (organization?.id) {
      queryClient.invalidateQueries({
        queryKey: ['organization-settings', organization.id],
      });
    }
  };

  return {
    ...query,
    updateSettings: updateMutation.mutate,
    updateSettingsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    invalidateSettings,
  };
}
