/**
 * Notification types for PulseDesk.
 *
 * TypeScript models matching the backend Notification API contract
 * (backend/apps/notifications). Notifications are user-scoped (not
 * organization-scoped in the URL). The NotificationViewSet enforces
 * user-level isolation on every endpoint.
 */

/**
 * Notification type enum matching backend NotificationType
 */
export type NotificationType = 'SLA_WARNING' | 'SLA_BREACH' | 'ESCALATION_TRIGGERED';

/**
 * Notification severity enum matching backend NotificationSeverity
 */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface NotificationItem {
  id: string;
  notification_type: NotificationType;
  title: string;
  severity: NotificationSeverity;
  is_read: boolean;
  created_at: string;
  organization?: string;
  incident_id?: string | null;
  message?: string;
}

/**
 * Paginated response from notification list endpoint.
 */
export interface PaginatedNotificationResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NotificationItem[];
}

/**
 * Full notification detail (NotificationSerializer).
 */
export interface Notification {
  id: string;
  organization: string;
  recipient: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  incident_id: string | null;
  escalation_event_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/**
 * Response from mark_read / mark_unread endpoints.
 */
export interface MarkNotificationReadResponse {
  message: string;
  notification: Notification;
}

/**
 * Response from mark_all_read endpoint.
 */
export interface MarkAllReadResponse {
  message: string;
  count: number;
}

/**
 * Response from unread_count endpoint.
 */
export interface UnreadCountResponse {
  unread_count: number;
}
