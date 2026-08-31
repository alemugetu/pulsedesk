/**
 * NotificationBell component for PulseDesk application shell.
 *
 * Provides an accessible notification dropdown in the AppNavbar showing the
 * authenticated user's notifications. Includes:
 * - Unread count badge
 * - Toggle to show only unread
 * - Mark single / mark all as read
 * - Empty, loading, and error states
 * - Close on outside click and Escape
 * - Keyboard-operable trigger
 *
 * Data comes from the real notification API via TanStack Query and is
 * user-scoped (matching the backend contract). No separate provider is used.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../features/notifications/hooks/useNotifications';

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data: notifications = [], isLoading, error } = useNotifications(unreadOnly);
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.unread_count ?? 0;
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleMarkRead = (id: string) => {
    markRead.mutate({ id, read: true });
  };

  const handleMarkAllRead = () => {
    markAll.mutate();
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative px-2"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          ref={containerRef}
          className="absolute right-0 top-full mt-2 w-80 rounded-md border border-border bg-card shadow-lg z-50"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setUnreadOnly((v) => !v)}
                aria-pressed={unreadOnly}
              >
                {unreadOnly ? 'Unread' : 'All'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleMarkAllRead}
                disabled={markAll.isPending || unreadCount === 0}
                aria-label="Mark all notifications as read"
              >
                {markAll.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading notifications...
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-8 px-4" role="alert">
                <AlertCircle className="h-6 w-6 text-destructive mb-2" aria-hidden="true" />
                <p className="text-sm text-destructive">Failed to load notifications</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            )}

            {!isLoading && !error && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
                </p>
              </div>
            )}

            {!isLoading && !error && notifications.length > 0 && (
              <ul className="divide-y divide-border" role="list">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => !notification.is_read && handleMarkRead(notification.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-3 text-left',
                        'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
                        !notification.is_read && 'bg-primary/5'
                      )}
                      aria-label={notification.is_read ? notification.title : `Mark ${notification.title} as read`}
                    >
                      {!notification.is_read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground truncate">
                          {notification.title}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
