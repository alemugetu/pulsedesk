/**
 * React hooks for fetching the audit log list.
 *
 * Provides TanStack Query integration with:
 * - Organization-scoped query keys (tenant isolation)
 * - Backend-supported filters and pagination
 * - Permission-aware access helper
 *
 * Backend permission: audit_log.view
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';
import { getAuditLogs } from '../services/auditService';
import type { AuditLogQueryParams } from '../types/audit.types';
import { AUDIT_LOG_VIEW_PERMISSION } from '../types/audit.types';

/**
 * Query key factory for audit log list queries.
 * Scoped by organization ID for tenant isolation — audit logs from one
 * organization never share a cache entry with another.
 */
export function getAuditLogsQueryKey(
  organizationId: string | null,
  params?: AuditLogQueryParams
): readonly [string, string | null, AuditLogQueryParams | undefined] {
  return ['audit-logs', organizationId, params] as const;
}

/**
 * Hook to fetch the audit log list for the active organization.
 *
 * @param params - Optional backend-supported filters/pagination
 * @returns TanStack Query result with audit log list data
 *
 * Behavior:
 * - Does not fetch without an active organization
 * - Includes organization ID in the query key for tenant isolation
 * - Automatically refetches when the organization changes
 */
export function useAuditLogs(params?: AuditLogQueryParams) {
  const organization = useOrganizationContext();
  const queryClient = useQueryClient();
  const organizationId = organization.currentOrganization?.id ?? null;

  const queryKey = getAuditLogsQueryKey(organizationId, params);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization context is required');
      }
      return getAuditLogs(organizationId, params);
    },
    enabled: !!organizationId,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Invalidate audit log list queries for the active organization.
   * Useful for manual refresh.
   */
  const invalidateAuditLogs = () => {
    if (organizationId) {
      queryClient.invalidateQueries({
        queryKey: ['audit-logs', organizationId],
      });
    }
  };

  return {
    ...query,
    invalidateAuditLogs,
  };
}

/**
 * Hook to check whether the current user can view audit logs.
 * Frontend UX check only — backend authorization (audit_log.view) is the
 * authoritative security boundary.
 */
export function useCanViewAuditLogs(): boolean {
  const { hasPermission } = useOrganizationContext();
  return hasPermission(AUDIT_LOG_VIEW_PERMISSION);
}