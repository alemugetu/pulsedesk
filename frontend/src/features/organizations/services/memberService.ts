/**
 * Member service for PulseDesk.
 * 
 * Handles all membership-related API calls.
 * Based on backend API contract:
 * - GET /api/v1/organizations/<uuid>/members/ - List organization members
 * - PATCH /api/v1/organizations/<uuid>/members/<uuid>/role/ - Assign role to membership
 */

import { api } from '../../../api/client';
import type {
  MembershipListResponse,
  MembershipRoleAssignRequest,
  MembershipRoleAssignResponse,
} from '../types/membership';

/**
 * Get all members of an organization
 * Requires member.view permission
 * GET /api/v1/organizations/<uuid>/members/
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<MembershipListResponse> {
  return api.get<MembershipListResponse>(
    `/api/v1/organizations/${organizationId}/members/`
  );
}

/**
 * Assign a role to a membership
 * Requires role.assign permission
 * PATCH /api/v1/organizations/<uuid>/members/<uuid>/role/
 */
export async function assignMembershipRole(
  organizationId: string,
  membershipId: string,
  data: MembershipRoleAssignRequest
): Promise<MembershipRoleAssignResponse> {
  return api.patch<MembershipRoleAssignResponse>(
    `/api/v1/organizations/${organizationId}/members/${membershipId}/role/`,
    data
  );
}
