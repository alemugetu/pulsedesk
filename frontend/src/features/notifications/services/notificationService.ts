/**
 * Notification service for PulseDesk.
 *
 * Handles notification API calls using the existing shared API client.
 * Based on the backend Notification API contract:
 *
 * - GET  /api/v1/notifications/                    List
 * - GET  /api/v1/notifications/<pk>/               Detail
 * - PATCH /api/v1/notifications/<pk>/              Update (is_read only)
 * - DELETE /api/v1/notifications/<pk>/             Delete
 * - PATCH /api/v1/notifications/<pk>/mark_read/    Mark read
 * - PATCH /api/v1/notifications/<pk>/mark_unread/  Mark unread
 * - POST /api/v1/notifications/mark_all_read/      Mark all read
 * - GET  /api/v1/notifications/unread_count/       Unread count
 *
 * Notifications are NOT organization-scoped in the URL; the backend scopes
 * them to the authenticated user.
 */

import { api } from '../../../api/client';
import type {
  Notification,
  NotificationItem,
  MarkNotificationReadResponse,
  MarkAllReadResponse,
  UnreadCountResponse,
} from '../types/notification.types';

const BASE_URL = '/api/v1/notifications';

/**
 * List notifications for the authenticated user.
 * GET /api/v1/notifications/
 */
export async function getNotifications(params?: {
  unread_only?: boolean;
  notification_type?: string;
  severity?: string;
}): Promise<NotificationItem[]> {
  const response = await api.get<NotificationItem[] | { results: NotificationItem[] }>(`${BASE_URL}/`, {
    params: {
      ...(params?.unread_only ? { unread_only: true } : {}),
      ...(params?.notification_type ? { notification_type: params.notification_type } : {}),
      ...(params?.severity ? { severity: params.severity } : {}),
    },
  });

  if (Array.isArray(response)) {
    return response;
  }
  if (response && Array.isArray((response as { results: NotificationItem[] }).results)) {
    return (response as { results: NotificationItem[] }).results;
  }
  return [];
}

/**
 * Get a single notification by ID.
 * GET /api/v1/notifications/<pk>/
 */
export async function getNotification(notificationId: string): Promise<Notification> {
  return api.get<Notification>(`${BASE_URL}/${notificationId}/`);
}

/**
 * Mark a notification as read.
 * PATCH /api/v1/notifications/<pk>/mark_read/
 */
export async function markNotificationRead(notificationId: string): Promise<MarkNotificationReadResponse> {
  return api.patch<MarkNotificationReadResponse>(`${BASE_URL}/${notificationId}/mark_read/`);
}

/**
 * Mark a notification as unread.
 * PATCH /api/v1/notifications/<pk>/mark_unread/
 */
export async function markNotificationUnread(notificationId: string): Promise<MarkNotificationReadResponse> {
  return api.patch<MarkNotificationReadResponse>(`${BASE_URL}/${notificationId}/mark_unread/`);
}

/**
 * Mark all notifications as read.
 * POST /api/v1/notifications/mark_all_read/
 */
export async function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  return api.post<MarkAllReadResponse>(`${BASE_URL}/mark_all_read/`);
}

/**
 * Get the unread notification count for the authenticated user.
 * GET /api/v1/notifications/unread_count/
 */
export async function getUnreadNotificationCount(): Promise<UnreadCountResponse> {
  return api.get<UnreadCountResponse>(`${BASE_URL}/unread_count/`);
}
