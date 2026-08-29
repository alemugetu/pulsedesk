/**
 * TanStack Query hooks for Operations Dashboard summary data (Phase 13.9).
 *
 * Covers the two summary-level endpoints:
 *  - GET .../dashboard/summary/               (aggregate counts)
 *  - GET .../dashboard/priority-distribution/ (counts by priority)
 *
 * Query keys are organization-aware so switching organizations produces a
 * distinct cache entry and never surfaces the previous tenant's data. Queries
 * are disabled until an organization is selected. Follows the same conventions
 * as the Phase 13.8 SLA hooks.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import {
  getDashboardSummary,
  getPriorityDistribution,
} from '../services/operationsService';

/**
 * Query key factory for the dashboard summary, scoped by organization.
 */
export function getOperationsSummaryQueryKey(organizationId: string | null) {
  return ['operations', 'summary', organizationId] as const;
}

/**
 * Query key factory for the priority distribution, scoped by organization.
 */
export function getOperationsPriorityQueryKey(organizationId: string | null) {
  return ['operations', 'priority-distribution', organizationId] as const;
}

/**
 * Hook to fetch the operations dashboard summary for the active organization.
 */
export function useOperationsSummary() {
  const organization = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  return useQuery({
    queryKey: getOperationsSummaryQueryKey(organizationId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization context is required');
      }
      return getDashboardSummary(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 30000,
    gcTime: 300000,
  });
}

/**
 * Hook to fetch the incident priority distribution for the active organization.
 */
export function useOperationsPriorityDistribution() {
  const organization = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  return useQuery({
    queryKey: getOperationsPriorityQueryKey(organizationId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization context is required');
      }
      return getPriorityDistribution(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 30000,
    gcTime: 300000,
  });
}
