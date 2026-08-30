/**
 * TypeScript types for Organization Settings.
 * 
 * These types exactly match the backend API contract defined in:
 * - backend/apps/settings/models.py
 * - backend/apps/settings/serializers.py
 * - backend/apps/settings/views.py
 * 
 * Backend permissions:
 * - GET: settings.view
 * - PATCH: settings.manage
 */

/**
 * Incident priority choices matching backend IncidentPriority enum
 * From backend/apps/incidents/models.py
 */
export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';

/**
 * Incident status choices matching backend IncidentStatus enum
 * From backend/apps/incidents/models.py
 */
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

/**
 * Complete organization settings response from GET endpoint
 * Matches OrganizationSettingsReadSerializer
 * 
 * GET /api/v1/organizations/{organization_id}/settings/
 */
export interface OrganizationSettings {
  /** Settings record UUID (read-only) */
  id: string;
  /** Default priority for new incidents */
  default_incident_priority: IncidentPriority;
  /** Default status for new incidents */
  default_incident_status: IncidentStatus;
  /** Whether incident comments are enabled */
  incident_comments_enabled: boolean;
  /** Whether incident notification emails are sent */
  notification_incident_emails_enabled: boolean;
  /** Whether escalation notification emails are sent */
  notification_escalation_emails_enabled: boolean;
  /** Whether SLA notification emails are sent */
  notification_sla_emails_enabled: boolean;
  /** Whether default SLA policy is auto-applied to new incidents */
  sla_auto_apply_default_policy: boolean;
  /** Whether default escalation policy is auto-evaluated for SLA breaches */
  escalation_auto_apply_default_policy: boolean;
  /** Timestamp when settings were created (read-only) */
  created_at: string;
  /** Timestamp when settings were last updated (read-only) */
  updated_at: string;
}

/**
 * Partial update request for PATCH endpoint
 * Matches OrganizationSettingsUpdateSerializer
 * 
 * PATCH /api/v1/organizations/{organization_id}/settings/
 * All fields are optional - only included fields are updated
 */
export interface OrganizationSettingsUpdateRequest {
  /** Default priority for new incidents (optional) */
  default_incident_priority?: IncidentPriority;
  /** Default status for new incidents (optional) */
  default_incident_status?: IncidentStatus;
  /** Whether incident comments are enabled (optional) */
  incident_comments_enabled?: boolean;
  /** Whether incident notification emails are sent (optional) */
  notification_incident_emails_enabled?: boolean;
  /** Whether escalation notification emails are sent (optional) */
  notification_escalation_emails_enabled?: boolean;
  /** Whether SLA notification emails are sent (optional) */
  notification_sla_emails_enabled?: boolean;
  /** Whether default SLA policy is auto-applied to new incidents (optional) */
  sla_auto_apply_default_policy?: boolean;
  /** Whether default escalation policy is auto-evaluated for SLA breaches (optional) */
  escalation_auto_apply_default_policy?: boolean;
}

/**
 * Response from PATCH endpoint
 * Returns the complete updated settings (same as GET response)
 */
export type OrganizationSettingsUpdateResponse = OrganizationSettings;

/**
 * API error response from backend
 */
export interface OrganizationSettingsError {
  /** Error detail message */
  detail?: string;
  /** Field-specific validation errors */
  [key: string]: string | string[] | undefined;
}

/**
 * Human-readable labels for incident priorities
 */
export const INCIDENT_PRIORITY_LABELS: Record<IncidentPriority, string> = {
  P1: 'P1 — Critical',
  P2: 'P2 — High',
  P3: 'P3 — Medium',
  P4: 'P4 — Low',
};

/**
 * Human-readable labels for incident statuses
 */
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/**
 * All incident priority choices for select dropdowns
 */
export const INCIDENT_PRIORITY_CHOICES: IncidentPriority[] = ['P1', 'P2', 'P3', 'P4'];

/**
 * All incident status choices for select dropdowns
 */
export const INCIDENT_STATUS_CHOICES: IncidentStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
