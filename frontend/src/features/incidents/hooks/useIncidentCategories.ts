/**
 * Incident category hooks for PulseDesk.
 *
 * TanStack Query integration for incident category API calls. Categories are
 * organization-scoped, so query keys are tenant-aware for cache isolation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as incidentService from '../services/incidentService';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '../types/incident.types';

/**
 * Query key factory for incident category queries (tenant-aware).
 */
export const incidentCategoryKeys = {
  all: (organizationId: string) => ['organizations', organizationId, 'incident-categories'] as const,
  list: (organizationId: string, activeOnly = false) =>
    [...incidentCategoryKeys.all(organizationId), 'list', { activeOnly }] as const,
};

/**
 * Hook to fetch incident categories for an organization.
 */
export function useIncidentCategories(organizationId: string, activeOnly = false) {
  return useQuery({
    queryKey: incidentCategoryKeys.list(organizationId, activeOnly),
    queryFn: () => incidentService.getIncidentCategories(organizationId, { is_active: activeOnly }),
    enabled: !!organizationId,
    staleTime: 3 * 60 * 1000,
  });
}

/**
 * Hook to create an incident category and invalidate the list.
 */
export function useCreateIncidentCategory(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryRequest) =>
      incidentService.createIncidentCategory(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentCategoryKeys.all(organizationId) });
    },
  });
}

/**
 * Hook to update an incident category and invalidate the list.
 */
export function useUpdateIncidentCategory(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateCategoryRequest }) =>
      incidentService.updateIncidentCategory(organizationId, categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentCategoryKeys.all(organizationId) });
    },
  });
}
