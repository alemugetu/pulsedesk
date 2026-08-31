/**
 * Notification hooks for PulseDesk.
 *
 * TanStack Query integration for the notification API. Notifications are
 * user-scoped, so query keys are NOT organization-scoped (matching the
 * backend URL structure).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notificationService from '../services/notificationService';

/**
 * Query key factory for notification queries.
 */
const baseNotificationKey = ['notifications'] as const;

export const notificationKeys = {
  all: baseNotificationKey,
  list: (unreadOnly?: boolean) => [...baseNotificationKey, 'list', { unreadOnly: unreadOnly ?? false }] as const,
  unreadCount: [...baseNotificationKey, 'unread-count'] as const,
};

/**
 * Hook to list notifications for the authenticated user.
 */
export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => notificationService.getNotifications({ unread_only: unreadOnly }),
    staleTime: 30000,
    gcTime: 300000,
  });
}

/**
 * Hook to get the unread notification count.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => notificationService.getUnreadNotificationCount(),
    staleTime: 15000,
    gcTime: 60000,
    refetchInterval: 60000,
  });
}

/**
 * Update a notification's read status and invalidate related queries.
 */
function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return {
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  };
}

/**
 * Hook to mark a single notification as read/unread.
 */
export function useMarkNotificationRead() {
  const { invalidate } = useInvalidateNotifications();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      read
        ? notificationService.markNotificationRead(id)
        : notificationService.markNotificationUnread(id),
    onSuccess: invalidate,
  });
}

/**
 * Hook to mark all notifications as read.
 */
export function useMarkAllNotificationsRead() {
  const { invalidate } = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notificationService.markAllNotificationsRead(),
    onSuccess: invalidate,
  });
}
