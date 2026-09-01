/**
 * Utility functions for organization settings.
 */

import type {
  IncidentPriority,
  IncidentStatus,
  OrganizationSettings,
  OrganizationSettingsUpdateRequest,
} from '../types/organizationSettings.types';

/**
 * Check if two settings objects are equal (for dirty state detection)
 */
export function areSettingsEqual(
  original: OrganizationSettings,
  current: Partial<OrganizationSettingsUpdateRequest>
): boolean {
  for (const key of Object.keys(current)) {
    const typedKey = key as keyof OrganizationSettingsUpdateRequest;
    if (current[typedKey] !== original[typedKey]) {
      return false;
    }
  }
  return true;
}

/**
 * Extract only the changed fields from current settings compared to original
 */
export function getChangedFields(
  original: OrganizationSettings,
  current: Partial<OrganizationSettingsUpdateRequest>
): OrganizationSettingsUpdateRequest {
  const changed: OrganizationSettingsUpdateRequest = {};
  
  for (const key of Object.keys(current)) {
    const typedKey = key as keyof OrganizationSettingsUpdateRequest;
    if (current[typedKey] !== undefined && current[typedKey] !== original[typedKey]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      changed[typedKey] = current[typedKey] as any;
    }
  }
  
  return changed;
}

/**
 * Validate incident priority value
 */
export function isValidIncidentPriority(value: string): value is IncidentPriority {
  return ['P1', 'P2', 'P3', 'P4'].includes(value);
}

/**
 * Validate incident status value
 */
export function isValidIncidentStatus(value: string): value is IncidentStatus {
  return ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(value);
}

/**
 * Format API error message for display
 */
export function formatSettingsError(error: unknown): string {
  if (error && typeof error === 'object' && 'detail' in error && error.detail) {
    return String(error.detail);
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    error.message &&
    error.message !== 'Unknown error'
  ) {
    return String(error.message);
  }
  return 'An error occurred while updating settings';
}
