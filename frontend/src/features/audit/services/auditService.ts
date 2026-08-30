/**
 * Audit Log service for PulseDesk.
 *
 * Handles audit log API calls using the existing API client.
 * Based on the backend API contract in backend/apps/audit_logs/.
 *
 * Endpoints:
 * - GET /api/v1/organizations/{organization_id}/audit-logs/ - List audit logs (paginated, filterable)
 * - GET /api/v1/organizations/{organization_id}/audit-logs/{audit_log_id}/ - Get audit log detail
 *
 * Backend permission:
 * - GET (list + detail): audit_log.view
 *
 * No POST, PATCH, PUT, or DELETE endpoints exist for audit logs.
 * Audit records are append-only and immutable. This service intentionally
 * implements read operations only.
 */

import { api } from '../../../api/client';
import type {
  AuditLog,
  AuditLogListResponse,
  AuditLogQueryParams,
} from '../types/audit.types';

/**
 * Build the organization-scoped audit log base URL.
 * The organization ID is always dynamic — never hard-coded.
 */
function getAuditLogsBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/audit-logs`;
}

/**
 * List audit logs for an organization.
 * GET /api/v1/organizations/{organization_id}/audit-logs/
 *
 * Requires: audit_log.view permission
 *
 * Supported query parameters (see `AuditLogQueryParams`):
 *   action, resource_type, resource_id, actor_id, date_from, date_to, page.
 *
 * @param organizationId - The organization UUID (tenant scope)
 * @param params - Optional backend-supported filters/pagination
 * @returns Paginated audit log list response
 */
export async function getAuditLogs(
  organizationId: string,
  params?: AuditLogQueryParams
): Promise<AuditLogListResponse> {
  const url = `${getAuditLogsBaseUrl(organizationId)}/`;
  return api.get<AuditLogListResponse>(url, { params });
}

/**
 * Retrieve a single audit log record.
 * GET /api/v1/organizations/{organization_id}/audit-logs/{audit_log_id}/
 *
 * Requires: audit_log.view permission
 * The record must belong to the provided organization (backend enforces scoping).
 *
 * @param organizationId - The organization UUID (tenant scope)
 * @param auditLogId - The audit log record UUID
 * @returns Audit log detail
 */
export async function getAuditLog(
  organizationId: string,
  auditLogId: string
): Promise<AuditLog> {
  const url = `${getAuditLogsBaseUrl(organizationId)}/${auditLogId}/`;
  return api.get<AuditLog>(url);
}

/**
 * Read-only guard: no mutation methods are exported.
 * Audit records are immutable; the backend exposes no write endpoints.
 */