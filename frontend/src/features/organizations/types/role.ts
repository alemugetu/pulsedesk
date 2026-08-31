/**
 * Role and Permission types for PulseDesk.
 * 
 * Based on the backend API contract from Django REST Framework.
 * Backend models: Permission, Role, RolePermission
 * API endpoints: /api/v1/organizations/<uuid>/roles/
 */

/**
 * Permission model matching backend PermissionSerializer
 */
export interface Permission {
  id: string;
  codename: string; // Format: "resource.action" e.g., "organization.view"
  name: string;
  resource: string;
  action: string;
  description: string;
}

/**
 * Role model matching backend RoleSerializer
 */
export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_system_role: boolean;
  permissions: string[]; // Array of permission codenames
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

/**
 * Request payload for creating a custom role
 * Matches backend RoleCreateSerializer
 */
export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions?: string[]; // Array of permission codenames
}

/**
 * Request payload for updating a role
 * Matches backend RoleUpdateSerializer
 */
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[]; // Full replacement list, null to leave unchanged
}

/**
 * Response from role list endpoint
 */
export type RoleListResponse = Role[];

/**
 * Response from role creation endpoint
 */
export type RoleCreateResponse = Role;

/**
 * Response from role detail/update/delete endpoint
 */
export type RoleDetailResponse = Role;

/**
 * Available permission codenames based on backend RBAC system
 * These are the actual permissions used in the PulseDesk backend
 * Phase 13.8: Added escalation.evaluate permission
 */
export const PERMISSION_CODENAMES = [
  'organization.view',
  'organization.update',
  'member.view',
  'member.invite',
  'member.remove',
  'member.suspend',
  'role.view',
  'role.manage',
  'role.assign',
  'incident.view',
  'incident.create',
  'incident.update',
  'incident.manage',
  'incident.assign',
  'incident.close',
  'incident.resolve',
  'settings.view',
  'settings.manage',
  'sla.view',
  'sla.manage',
  'escalation.view',
  'escalation.manage',
  'escalation.evaluate',
  'audit_log.view',
  'report.view',
] as const;

export type PermissionCodename = typeof PERMISSION_CODENAMES[number];

/**
 * System role slugs that are automatically seeded by the backend
 */
export const SYSTEM_ROLE_SLUGS = [
  'organization-owner',
  'organization-admin',
  'operations-manager',
  'agent',
  'viewer',
] as const;

export type SystemRoleSlug = typeof SYSTEM_ROLE_SLUGS[number];

/**
 * Human-readable labels for permission codenames.
 * Converts backend codenames (e.g., "incident.create") to user-friendly labels (e.g., "Incident — Create").
 * Unknown permissions use a safe fallback format.
 */
export const PERMISSION_LABELS: Record<string, string> = {
  'organization.view': 'Organization — View',
  'organization.update': 'Organization — Update',
  'member.view': 'Member — View',
  'member.invite': 'Member — Invite',
  'member.remove': 'Member — Remove',
  'member.suspend': 'Member — Suspend',
  'role.view': 'Roles — View',
  'role.manage': 'Roles — Manage',
  'role.assign': 'Roles — Assign',
  'incident.view': 'Incident — View',
  'incident.create': 'Incident — Create',
  'incident.update': 'Incident — Update',
  'incident.manage': 'Incident — Manage',
  'incident.assign': 'Incident — Assign',
  'incident.close': 'Incident — Close',
  'incident.resolve': 'Incident — Resolve',
  'settings.view': 'Settings — View',
  'settings.manage': 'Settings — Manage',
  'sla.view': 'SLA — View',
  'sla.manage': 'SLA — Manage',
  'escalation.view': 'Escalation — View',
  'escalation.manage': 'Escalation — Manage',
  'escalation.evaluate': 'Escalation — Evaluate',
  'audit_log.view': 'Audit Log — View',
  'report.view': 'Reports — View',
} as const;

/**
 * Get a human-readable label for a permission codename.
 * Falls back to a formatted version of the codename if not in the mapping.
 */
export function getPermissionLabel(codename: string): string {
  return PERMISSION_LABELS[codename] || formatUnknownPermission(codename);
}

/**
 * Format an unknown permission codename into a human-readable label.
 * Example: "some.permission" → "Some — Permission"
 */
function formatUnknownPermission(codename: string): string {
  const [resource, action] = codename.split('.');
  if (!resource || !action) {
    return codename;
  }
  const formattedResource = resource
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const formattedAction = action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return `${formattedResource} — ${formattedAction}`;
}
