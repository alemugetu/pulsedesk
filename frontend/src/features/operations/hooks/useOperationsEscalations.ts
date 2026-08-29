/**
 * React hook for the Operations Command Center escalation metrics.
 *
 * Fetches GET /api/v1/organizations/<organization_id>/dashboard/escalation-metrics/.
 * Organization-scoped query key for tenant isolation.
 * Read-only metrics — escalation evaluation/processing belongs to the backend.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getEscalationMetrics } from '../services/operationsService';
import type { EscalationMetrics } from '../types/operations.types';

/**
 * Query key factory for the dashboard escalation metrics.
 * Scoped by organization — switching organizations yields a distinct key.
 */
export function getOperationsEscalationsQueryKey(
  organizationId: string | null
): readonly [string, string | null, string] {
  return ['operations', organizationId, 'escalation-metrics'] as const;
}

/**
 * Hook to fetch escalation metrics for the current organization.
 *
 * @returns TanStack Query result with EscalationMetrics data.
 */
export function useOperationsEscalations() {
  const organization = useCurrentOrganization();
  const queryKey = getOperationsEscalationsQueryKey(organization?.id ?? null);

  return useQuery<EscalationMetrics>({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getEscalationMetrics(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}