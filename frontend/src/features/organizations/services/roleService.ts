/**
 * Role service for PulseDesk.
 * 
 * Handles all role-related API calls.
 * Based on backend API contract:
 * - GET /api/v1/organizations/<uuid>/roles/ - List organization roles
 * - POST /api/v1/organizations/<uuid>/roles/ - Create custom role
 * - GET /api/v1/organizations/<uuid>/roles/<uuid>/ - Get role detail
 * - PUT /api/v1/organizations/<uuid>/roles/<uuid>/ - Update role
 * - DELETE /api/v1/organizations/<uuid>/roles/<uuid>/ - Delete custom role
 */

import { api } from '../../../api/client';
import type {
  RoleListResponse,
  CreateRoleRequest,
  RoleCreateResponse,
  UpdateRoleRequest,
  RoleDetailResponse,
} from '../types/role';

/**
 * Get all roles in an organization
 * Requires role.view permission
 * GET /api/v1/organizations/<uuid>/roles/
 */
export async function getOrganizationRoles(
  organizationId: string
): Promise<RoleListResponse> {
  return api.get<RoleListResponse>(
    `/api/v1/organizations/${organizationId}/roles/`
  );
}

/**
 * Create a custom role in an organization
 * Requires role.manage permission
 * POST /api/v1/organizations/<uuid>/roles/
 */
export async function createRole(
  organizationId: string,
  data: CreateRoleRequest
): Promise<RoleCreateResponse> {
  return api.post<RoleCreateResponse>(
    `/api/v1/organizations/${organizationId}/roles/`,
    data
  );
}

/**
 * Get role details
 * Requires role.view permission
 * GET /api/v1/organizations/<uuid>/roles/<uuid>/
 */
export async function getRole(
  organizationId: string,
  roleId: string
): Promise<RoleDetailResponse> {
  return api.get<RoleDetailResponse>(
    `/api/v1/organizations/${organizationId}/roles/${roleId}/`
  );
}

/**
 * Update a custom role
 * Requires role.manage permission
 * PUT /api/v1/organizations/<uuid>/roles/<uuid>/
 */
export async function updateRole(
  organizationId: string,
  roleId: string,
  data: UpdateRoleRequest
): Promise<RoleDetailResponse> {
  return api.put<RoleDetailResponse>(
    `/api/v1/organizations/${organizationId}/roles/${roleId}/`,
    data
  );
}

/**
 * Delete a custom role
 * Requires role.manage permission
 * System roles (is_system_role: true) cannot be deleted
 * DELETE /api/v1/organizations/<uuid>/roles/<uuid>/
 */
export async function deleteRole(
  organizationId: string,
  roleId: string
): Promise<void> {
  return api.delete<void>(
    `/api/v1/organizations/${organizationId}/roles/${roleId}/`
  );
}
