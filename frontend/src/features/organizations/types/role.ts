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
  'incident.manage',
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
