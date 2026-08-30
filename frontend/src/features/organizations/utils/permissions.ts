/**
 * Permission utilities for PulseDesk organizations.
 * 
 * Provides helper functions for permission-based UI behavior.
 * IMPORTANT: These are frontend UX checks only - backend authorization is the security boundary.
 * Never rely solely on frontend permission checks for security.
 * Phase 13.8: Added SLA and escalation permissions.
 */

import type { PermissionCodename } from '../types/role';

/**
 * Check if a permission codename is valid
 */
export function isValidPermission(codename: string): codename is PermissionCodename {
  const validPermissions: readonly string[] = [
    'organization.view',
    'organization.update',
    'member.view',
    'member.invite',
    'member.remove',
    'member.suspend',
    'role.view',
    'role.manage',
    'role.assign',
    'sla.view',
    'sla.manage',
    'escalation.view',
    'escalation.manage',
    'escalation.evaluate',
  ] as const;
  
  return validPermissions.includes(codename);
}

/**
 * Get permissions that allow organization creation
 * Based on backend RBAC: Owner and Admin roles can create organizations
 */
export function canCreateOrganization(userPermissions: string[]): boolean {
  // Organization creation requires organization.view permission at minimum
  return userPermissions.length === 0 || userPermissions.includes('organization.view');
}

/**
 * Get permissions that allow viewing organization members
 */
export function canViewMembers(userPermissions: string[]): boolean {
  return userPermissions.includes('member.view');
}

/**
 * Get permissions that allow inviting members
 */
export function canInviteMembers(userPermissions: string[]): boolean {
  return userPermissions.includes('member.invite');
}

/**
 * Get permissions that allow removing members
 */
export function canRemoveMembers(userPermissions: string[]): boolean {
  return userPermissions.includes('member.remove');
}

/**
 * Get permissions that allow suspending members
 */
export function canSuspendMembers(userPermissions: string[]): boolean {
  return userPermissions.includes('member.suspend');
}

/**
 * Get permissions that allow viewing roles
 */
export function canViewRoles(userPermissions: string[]): boolean {
  return userPermissions.includes('role.view');
}

/**
 * Get permissions that allow managing roles
 */
export function canManageRoles(userPermissions: string[]): boolean {
  return userPermissions.includes('role.manage');
}

/**
 * Get permissions that allow assigning roles
 */
export function canAssignRoles(userPermissions: string[]): boolean {
  return userPermissions.includes('role.assign');
}

/**
 * Get permissions that allow updating organization settings
 */
export function canUpdateOrganization(userPermissions: string[]): boolean {
  return userPermissions.includes('organization.update');
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

/**
 * Get permissions that allow viewing SLA policies
 */
export function canViewSlaPolicies(userPermissions: string[]): boolean {
  return userPermissions.includes('sla.view');
}

/**
 * Get permissions that allow managing SLA policies
 */
export function canManageSlaPolicies(userPermissions: string[]): boolean {
  return userPermissions.includes('sla.manage');
}

/**
 * Get permissions that allow viewing escalation policies
 */
export function canViewEscalationPolicies(userPermissions: string[]): boolean {
  return userPermissions.includes('escalation.view');
}

/**
 * Get permissions that allow managing escalation policies
 */
export function canManageEscalationPolicies(userPermissions: string[]): boolean {
  return userPermissions.includes('escalation.manage');
}

/**
 * Get permissions that allow viewing reports
 */
export function canViewReports(userPermissions: string[]): boolean {
  return userPermissions.includes('report.view');
}

/**
 * Get permissions that allow evaluating escalations
 */
export function canEvaluateEscalations(userPermissions: string[]): boolean {
  return userPermissions.includes('escalation.evaluate');
}
