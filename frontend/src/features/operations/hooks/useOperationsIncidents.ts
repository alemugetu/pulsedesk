/**
 * React hook for the Operations Command Center incident list.
 *
 * Fetches GET /api/v1/organizations/<organization_id>/dashboard/incidents/
 * with backend-supported filters, ordering, and pagination.
 * Organization-scoped query key for tenant isolation.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getDashboardIncidents } from '../services/operationsService';
import type {
  DashboardIncidentListResponse,
  OperationsIncidentFilters,
} from '../types/operations.types';

/**
 * Query key factory for the dashboard incident list.
 * Scoped by organization and the active filters.
 */
export function getOperationsIncidentsQueryKey(
  organizationId: string | null,
  filters?: OperationsIncidentFilters
): readonly [string, string | null, string, OperationsIncidentFilters | undefined] {
  return ['operations', organizationId, 'incidents', filters] as const;
}

/**
 * Hook to fetch the filtered dashboard incident list for the current organization.
 *
 * @param params - Backend-supported filters (status, priority, sla_state,
 *                 escalation_state, ordering, page, page_size, ...).
 * @returns TanStack Query result with paginated dashboard incidents.
 */
export function useOperationsIncidents(params?: OperationsIncidentFilters) {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsIncidentsQueryKey(organization?.id ?? null, params);

  return useQuery<DashboardIncidentListResponse>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getDashboardIncidents(organization.id, params);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}