/**
 * Membership types for PulseDesk.
 * 
 * Based on the backend API contract from Django REST Framework.
 * Backend models: Membership, MembershipStatus
 * API endpoints: /api/v1/organizations/<uuid>/members/
 */

/**
 * Membership status enum matching backend MembershipStatus
 */
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

/**
 * User reference within membership
 * Matches backend MembershipUserSerializer
 */
export interface MembershipUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Role reference within membership
 * Simplified version - full role details in role types
 */
export interface MembershipRole {
  id: string;
  name: string;
  slug: string;
}

/**
 * Membership model matching backend MembershipSerializer
 */
export interface Membership {
  id: string;
  user: MembershipUser;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

/**
 * Response from organization members list endpoint
 */
export type MembershipListResponse = Membership[];

/**
 * Request payload for assigning a role to a membership
 * Matches backend MembershipRoleAssignSerializer
 */
export interface MembershipRoleAssignRequest {
  role_id?: string | null; // null to remove role
}

/**
 * Response from membership role assignment endpoint
 */
export type MembershipRoleAssignResponse = Membership;
