/**
 * React hook for fetching a single audit log record.
 *
 * Provides TanStack Query integration with:
 * - Organization-scoped query keys (tenant isolation)
 * - Combined organization + audit log ID key
 * - Fetch gated until both IDs are available
 *
 * Backend permission: audit_log.view
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getAuditLog } from '../services/auditService';

/**
 * Query key factory for a single audit log record.
 * Scoped by both organization ID and audit log ID.
 */
export function getAuditLogQueryKey(
  organizationId: string | null,
  auditLogId: string | null
): readonly [string, string | null, string | null] {
  return ['audit-log', organizationId, auditLogId] as const;
}

/**
 * Hook to fetch a single audit log record.
 *
 * @param auditLogId - The audit log record UUID
 * @returns TanStack Query result with audit log detail data
 *
 * Behavior:
 * - Does not fetch until both the organization and audit log ID are available
 * - Includes organization ID and audit log ID in the query key
 */
export function useAuditLog(auditLogId: string | null | undefined) {
  const organization = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const logId = auditLogId ?? null;

  const queryKey = getAuditLogQueryKey(organizationId, logId);

  return useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization context is required');
      }
      if (!logId) {
        throw new Error('Audit log ID is required');
      }
      return getAuditLog(organizationId, logId);
    },
    enabled: !!organizationId && !!logId,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}