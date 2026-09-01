/**
 * Member service for PulseDesk.
 * 
 * Handles all membership-related API calls.
 * Based on backend API contract:
 * - GET /api/v1/organizations/<uuid>/members/ - List organization members
 * - PATCH /api/v1/organizations/<uuid>/members/<uuid>/role/ - Assign role to membership
 */

import { api } from '../../../api/client';
import { register as registerUser } from '../../auth/services/authService';
import type {
  Membership,
  MembershipListResponse,
  MembershipRoleAssignRequest,
  MembershipRoleAssignResponse,
  AddMembershipRequest,
  UpdateMembershipStatusRequest,
  RegisterAndAddMemberRequest,
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
 * Add a member to an organization (by email or user_id)
 * Requires member.invite permission
 * POST /api/v1/organizations/<uuid>/members/
 */
export async function addOrganizationMember(
  organizationId: string,
  data: AddMembershipRequest
): Promise<Membership> {
  return api.post<Membership>(
    `/api/v1/organizations/${organizationId}/members/`,
    data
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

/**
 * Update member status (suspend, reactivate)
 * Requires member.suspend permission
 * PATCH /api/v1/organizations/<uuid>/members/<uuid>/
 */
export async function updateMembershipStatus(
  organizationId: string,
  membershipId: string,
  data: UpdateMembershipStatusRequest
): Promise<Membership> {
  return api.patch<Membership>(
    `/api/v1/organizations/${organizationId}/members/${membershipId}/`,
    data
  );
}

/**
 * Remove a member from an organization
 * Requires member.remove permission
 * DELETE /api/v1/organizations/<uuid>/members/<uuid>/
 */
export async function removeOrganizationMember(
  organizationId: string,
  membershipId: string
): Promise<void> {
  return api.delete<void>(
    `/api/v1/organizations/${organizationId}/members/${membershipId}/`
  );
}

/**
 * Two-stage workflow: Register user account, then create organization membership with initial role.
 * Handles partial failures safely.
 */
export async function registerAndAddMember(
  organizationId: string,
  data: RegisterAndAddMemberRequest
): Promise<Membership> {
  // Stage 1: Register User Account
  if (data.password) {
    try {
      console.log('Attempting to register user:', {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        hasPassword: !!data.password,
        hasPasswordConfirm: !!data.password_confirm,
      });
      
      await registerUser({
        email: data.email,
        password: data.password,
        password_confirm: data.password_confirm || data.password,
        first_name: data.first_name,
        last_name: data.last_name,
      });
      
      console.log('User registration successful');
    } catch (err) {
      console.error('Registration error:', err);
      
      // If error indicates user already exists, proceed to try adding membership
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Check if this is an "already exists" error or validation error
      if (errorMessage.toLowerCase().includes('already exists')) {
        // User already exists, proceed to add membership
        console.log('User already exists, proceeding to add membership');
      } else {
        // This is a validation error, throw it with details
        // Try to extract field-specific errors if available
        if (err && typeof err === 'object' && 'fieldErrors' in err) {
          const fieldErrors = (err as { fieldErrors?: Record<string, string[]> }).fieldErrors;
          if (fieldErrors) {
            const errorMessages = Object.entries(fieldErrors)
              .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
              .join('; ');
            const error = new Error(`Registration failed: ${errorMessages}`);
            (error as Error & { cause?: unknown }).cause = err;
            throw error;
          }
        }
        
        // Log the full error for debugging
        console.error('Full error object:', JSON.stringify(err, null, 2));
        const error = new Error(`Failed to create user account: ${errorMessage}`);
        (error as Error & { cause?: unknown }).cause = err;
        throw error;
      }
    }
  }

  // Stage 2: Create Membership in Organization with Role
  try {
    console.log('Adding user to organization:', organizationId);
    return await addOrganizationMember(organizationId, {
      email: data.email,
      role_id: data.role_id || null,
    });
  } catch (err) {
    console.error('Membership addition error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // Handle field errors from membership addition
    if (err && typeof err === 'object' && 'fieldErrors' in err) {
      const fieldErrors = (err as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      if (fieldErrors) {
        const errorMessages = Object.entries(fieldErrors)
          .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
          .join('; ');
        const error = new Error(`Failed to add member: ${errorMessages}`);
        (error as Error & { cause?: unknown }).cause = err;
        throw error;
      }
    }
    
    const error = new Error(`User account exists, but adding to organization failed: ${errorMessage}`);
    (error as Error & { cause?: unknown }).cause = err;
    throw error;
  }
}

