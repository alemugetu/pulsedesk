/**
 * TypeScript types for the Audit & Operational History feature.
 *
 * These types exactly match the backend API contract defined in:
 * - backend/apps/audit_logs/models.py
 * - backend/apps/audit_logs/serializers.py
 * - backend/apps/audit_logs/views.py
 * - backend/schema.yml (AuditLog, AuditLogActor, ActionEnum, PaginatedAuditLogList)
 *
 * Backend permission:
 * - GET: audit_log.view
 */

import type { PaginatedResponse } from '../../../types/common';

/**
 * Stable, machine-readable action identifiers.
 * Matches backend `AuditAction` TextChoices (backend/apps/audit_logs/models.py)
 * and the generated `ActionEnum` in schema.yml.
 */
export type AuditAction =
  | 'incident.created'
  | 'incident.updated'
  | 'incident.status_changed'
  | 'incident.priority_changed'
  | 'incident.assigned'
  | 'incident.resolved'
  | 'incident.closed'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'attachment.uploaded'
  | 'attachment.deleted'
  | 'member.added'
  | 'member.suspended'
  | 'member.removed'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'role.assigned'
  | 'sla_policy.created'
  | 'sla_policy.updated'
  | 'sla_target.created'
  | 'sla_target.updated'
  | 'sla.breached'
  | 'escalation_policy.created'
  | 'escalation_policy.updated'
  | 'escalation.triggered'
  | 'settings.updated';

/**
 * Contains every action codename the backend can emit, in the order defined
 * by the backend `AuditAction` TextChoices. Used for filter UI options.
 */
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'incident.created',
  'incident.updated',
  'incident.status_changed',
  'incident.priority_changed',
  'incident.assigned',
  'incident.resolved',
  'incident.closed',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'attachment.uploaded',
  'attachment.deleted',
  'member.added',
  'member.suspended',
  'member.removed',
  'role.created',
  'role.updated',
  'role.deleted',
  'role.assigned',
  'sla_policy.created',
  'sla_policy.updated',
  'sla_target.created',
  'sla_target.updated',
  'sla.breached',
  'escalation_policy.created',
  'escalation_policy.updated',
  'escalation.triggered',
  'settings.updated',
] as const;

/**
 * Safe summary of the actor (user) who performed the action.
 * Matches backend `AuditLogActorSerializer`. `first_name`/`last_name` are
 * `allow_blank=True, required=False`.
 */
export interface AuditLogActor {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Safe `changes` JSONField metadata attached at log time.
 * Backend guarantees this never contains passwords, tokens, or secrets.
 * The serializer exposes the raw JSON object with no schema of its own,
 * so it is typed as a strict record of primitives.
 */
export interface AuditLogChanges {
  [key: string]: string | number | boolean | null | AuditLogChanges | undefined;
}

/**
 * A single audit log record.
 * Matches backend `AuditLogSerializer` / schema.yml `AuditLog`.
 * All fields are read-only.
 */
export interface AuditLog {
  /** Audit record UUID (read-only) */
  id: string;
  /** Organization UUID that owns the record (read-only) */
  organization: string;
  /** Actor summary, or null for system-generated events (SLA monitor, escalation engine) */
  actor: AuditLogActor | null;
  /** Stable dot-notation action identifier (read-only) */
  action: AuditAction;
  /** Class/entity type of the affected resource, e.g. "incident" (read-only) */
  resource_type: string;
  /** String representation of the affected resource primary key (read-only) */
  resource_id: string;
  /** Safe contextual metadata: before/after values, labels (read-only) */
  changes: AuditLogChanges;
  /** Client IP at the time of the action, or null (read-only) */
  ip_address: string | null;
  /** Immutable timestamp (read-only, ISO 8601 with timezone) */
  created_at: string;
}

/**
 * Paginated audit log list response.
 * Matches backend `PaginatedAuditLogList` (DRF PageNumberPagination) in schema.yml.
 */
export type AuditLogListResponse = PaginatedResponse<AuditLog>;

/**
 * Audit log detail response.
 * The detail endpoint returns the exact same record shape as the list items.
 */
export type AuditLogDetail = AuditLog;

/**
 * Supported query parameters for the audit log list endpoint.
 * Matches the backend documented filters exactly:
 *   ?action=<AuditAction value>
 *   ?resource_type=<string>
 *   ?resource_id=<string>
 *   ?actor_id=<uuid>
 *   ?date_from=<ISO 8601 datetime>
 *   ?date_to=<ISO 8601 datetime>
 * Plus `page` for PageNumberPagination.
 */
export interface AuditLogQueryParams {
  action?: AuditAction;
  resource_type?: string;
  resource_id?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}

/**
 * Filter values surfaced in the UI (excludes pagination).
 * Implemented only because the backend supports these exact filters.
 */
export type AuditLogFilters = Omit<AuditLogQueryParams, 'page'>;

/**
 * API error response shape from the backend (consistent with other features).
 */
export interface AuditLogError {
  detail?: string;
  [key: string]: unknown;
}

/**
 * Human-readable labels for audit actions.
 * Matches the second value of backend `AuditAction` TextChoices.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'incident.created': 'Incident Created',
  'incident.updated': 'Incident Updated',
  'incident.status_changed': 'Incident Status Changed',
  'incident.priority_changed': 'Incident Priority Changed',
  'incident.assigned': 'Incident Assigned',
  'incident.resolved': 'Incident Resolved',
  'incident.closed': 'Incident Closed',
  'comment.created': 'Comment Created',
  'comment.updated': 'Comment Updated',
  'comment.deleted': 'Comment Deleted',
  'attachment.uploaded': 'Attachment Uploaded',
  'attachment.deleted': 'Attachment Deleted',
  'member.added': 'Member Added',
  'member.suspended': 'Member Suspended',
  'member.removed': 'Member Removed',
  'role.created': 'Role Created',
  'role.updated': 'Role Updated',
  'role.deleted': 'Role Deleted',
  'role.assigned': 'Role Assigned',
  'sla_policy.created': 'SLA Policy Created',
  'sla_policy.updated': 'SLA Policy Updated',
  'sla_target.created': 'SLA Target Created',
  'sla_target.updated': 'SLA Target Updated',
  'sla.breached': 'SLA Breached',
  'escalation_policy.created': 'Escalation Policy Created',
  'escalation_policy.updated': 'Escalation Policy Updated',
  'escalation.triggered': 'Escalation Triggered',
  'settings.updated': 'Organization Settings Updated',
};

/**
 * Page size used by the backend's DEFAULT_PAGE_SIZE (config/settings/base.py).
 * The list endpoint uses DRF PageNumberPagination with PAGE_SIZE=50.
 */
export const AUDIT_LOG_PAGE_SIZE = 50;

/**
 * Backend permission codename required to list/retrieve audit logs.
 */
export const AUDIT_LOG_VIEW_PERMISSION = 'audit_log.view';