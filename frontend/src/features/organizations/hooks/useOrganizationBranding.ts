/**
 * Hook for managing organization branding with TanStack Query.
 *
 * Scopes branding query keys to the active organization ID,
 * ensuring automatic cache invalidation and tenant isolation on organization switch.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizationBranding,
  saveOrganizationLogo,
  removeOrganizationLogo,
} from '../services/brandingService';
import { useOptionalOrganizationContext } from '../context/organizationContextDef';
import type { OrganizationBranding } from '../types/branding.types';

export const organizationBrandingKeys = {
  all: ['organization-branding'] as const,
  detail: (orgId: string | undefined) => ['organization-branding', orgId] as const,
};

export function useOrganizationBranding(organizationId?: string) {
  const orgContext = useOptionalOrganizationContext();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const activeOrgId = organizationId || orgContext?.currentOrganization?.id;

  const brandingQuery = useQuery<OrganizationBranding>({
    queryKey: organizationBrandingKeys.detail(activeOrgId),
    queryFn: () => getOrganizationBranding(activeOrgId || ''),
    enabled: Boolean(activeOrgId),
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!activeOrgId) {
        throw new Error('No active organization selected.');
      }
      setMutationError(null);
      return saveOrganizationLogo(activeOrgId, file);
    },
    onSuccess: (updatedBranding) => {
      queryClient.setQueryData(
        organizationBrandingKeys.detail(activeOrgId),
        updatedBranding
      );
      queryClient.invalidateQueries({
        queryKey: organizationBrandingKeys.detail(activeOrgId),
      });
    },
    onError: (err: Error) => {
      setMutationError(err.message || 'Failed to save company logo.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) {
        throw new Error('No active organization selected.');
      }
      setMutationError(null);
      return removeOrganizationLogo(activeOrgId);
    },
    onSuccess: () => {
      queryClient.setQueryData(organizationBrandingKeys.detail(activeOrgId), {
        organizationId: activeOrgId || '',
        logoUrl: null,
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({
        queryKey: organizationBrandingKeys.detail(activeOrgId),
      });
    },
    onError: (err: Error) => {
      setMutationError(err.message || 'Failed to remove company logo.');
    },
  });

  return {
    branding: brandingQuery.data ?? null,
    logoUrl: brandingQuery.data?.logoUrl ?? null,
    isLoading: brandingQuery.isLoading,
    isSaving: saveMutation.isPending || removeMutation.isPending,
    saveError: mutationError,
    saveLogoAsync: saveMutation.mutateAsync,
    removeLogoAsync: removeMutation.mutateAsync,
  };
}
