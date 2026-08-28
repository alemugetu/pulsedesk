/**
 * React hook for organization detail operations using TanStack Query.
 * 
 * Provides data fetching for single organization details.
 * This is separated from useOrganizations to avoid circular dependencies
 * and provide a cleaner import interface.
 */

import { useQuery } from '@tanstack/react-query';
import * as organizationService from '../services/organizationService';
import { organizationKeys } from './useOrganizations';

/**
 * Hook to fetch a single organization by ID
 * Requires organization ID for tenant-aware caching
 */
export function useOrganization(organizationId: string) {
  return useQuery({
    queryKey: organizationKeys.detail(organizationId),
    queryFn: () => organizationService.getOrganization(organizationId),
    enabled: !!organizationId, // Only run if organizationId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
