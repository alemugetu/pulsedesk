/**
 * Accessibility utilities for PulseDesk.
 * 
 * Provides:
 * - Screen-reader live region announcement helper
 * - Human-readable permission formatting (avoiding raw permission codenames)
 * - User-friendly error message sanitization
 */

let screenReaderLiveRegion: HTMLElement | null = null;

/**
 * Announces a message to screen readers via a dynamic offscreen live region.
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof document === 'undefined' || !message.trim()) return;

  if (!screenReaderLiveRegion) {
    screenReaderLiveRegion = document.createElement('div');
    screenReaderLiveRegion.id = 'a11y-screen-reader-announcer';
    screenReaderLiveRegion.className = 'sr-only';
    screenReaderLiveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(screenReaderLiveRegion);
  }

  screenReaderLiveRegion.setAttribute('aria-live', priority);
  // Clear first so re-announcing identical messages still triggers screen readers
  screenReaderLiveRegion.textContent = '';
  setTimeout(() => {
    if (screenReaderLiveRegion) {
      screenReaderLiveRegion.textContent = message;
    }
  }, 50);
}

/**
 * Human-readable mapping for RBAC permission codenames.
 */
const PERMISSION_DISPLAY_MAP: Record<string, string> = {
  'organization.view': 'View Organization Details',
  'organization.update': 'Update Organization Settings',
  'organization.delete': 'Delete Organization',
  'member.view': 'View Organization Members',
  'member.invite': 'Invite Team Members',
  'member.update': 'Update Member Roles',
  'member.remove': 'Remove Members from Organization',
  'role.view': 'View Roles and Permissions',
  'role.create': 'Create Custom Roles',
  'role.update': 'Edit Roles and Permissions',
  'role.delete': 'Delete Custom Roles',
  'incident.view': 'View Incidents',
  'incident.create': 'Create Incidents',
  'incident.update': 'Update Incidents',
  'incident.delete': 'Delete Incidents',
  'incident.assign': 'Assign Incidents',
  'incident.status': 'Change Incident Status',
  'sla.view': 'View SLA Policies',
  'sla.manage': 'Manage SLA Policies',
  'escalation.view': 'View Escalation Policies',
  'escalation.manage': 'Manage Escalation Policies',
  'report.view': 'View Reports and Analytics',
  'audit_log.view': 'View Audit and Security Logs',
  'settings.view': 'View Organization Settings',
  'settings.update': 'Modify Organization Settings',
};

/**
 * Converts a raw permission codename into a human-readable title.
 */
export function formatPermissionName(permission: string): string {
  if (!permission) return 'Required Permission';
  if (PERMISSION_DISPLAY_MAP[permission]) {
    return PERMISSION_DISPLAY_MAP[permission];
  }

  // Fallback: Convert snake_case or dot.notation into Title Case
  return permission
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Standardized mapping for backend error codes into user-facing messages.
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'organization.membership.permission_denied': 'You do not have permission to perform this action.',
  'permission_denied': 'You do not have permission to perform this action.',
  'authentication_failed': 'Invalid email or password. Please try again.',
  'token_expired': 'Your session has expired. Please sign in again.',
  'not_found': 'The requested resource was not found.',
  'network_error': 'A network error occurred. Please check your internet connection.',
};

/**
 * Formats an unknown error or backend string into a clear user-friendly explanation.
 */
export function formatUserFriendlyError(error: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (ERROR_MESSAGE_MAP[trimmed]) {
      return ERROR_MESSAGE_MAP[trimmed];
    }
    return trimmed;
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (ERROR_MESSAGE_MAP[msg]) {
      return ERROR_MESSAGE_MAP[msg];
    }
    return msg || fallback;
  }

  // Handle Axios / API error response objects
  if (typeof error === 'object' && error !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errObj = error as any;
    const detail = errObj.response?.data?.detail || errObj.response?.data?.message || errObj.message;
    if (typeof detail === 'string') {
      return ERROR_MESSAGE_MAP[detail] || detail;
    }
  }

  return fallback;
}
