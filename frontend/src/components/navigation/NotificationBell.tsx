/**
 * NotificationBell component for PulseDesk application shell.
 *
 * Provides an accessible notification dropdown in the AppNavbar showing the
 * authenticated user's notifications with:
 * - Unread count badge with aria-live updates
 * - Filter toggle for unread only
 * - Tenant isolation: scoped to active organization
 * - Notification severity and operational type badges
 * - Click-to-navigate directly to the related incident route (/app/incidents/:id)
 * - Mark single / mark all as read
 * - Loading, error with retry, and empty states
 * - Keyboard navigation (Tab, Enter, Escape) and outside click closure
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Loader2,
  AlertCircle,
  Inbox,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../features/notifications/hooks/useNotifications';
import { getNotification } from '../../features/notifications/services/notificationService';
import { useCurrentOrganization } from '../../features/organizations/context/organizationContextDef';
import type { NotificationItem, NotificationType, NotificationSeverity } from '../../features/notifications/types/notification.types';

function formatRelativeTime(iso: string): string {
  if (!iso) return '';
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

function getNotificationTypeMeta(type: NotificationType) {
  switch (type) {
    case 'SLA_BREACH':
      return {
        label: 'SLA Breach',
        icon: AlertTriangle,
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
      };
    case 'SLA_WARNING':
      return {
        label: 'SLA Warning',
        icon: Clock,
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
      };
    case 'ESCALATION_TRIGGERED':
      return {
        label: 'Escalation',
        icon: ArrowUpRight,
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900',
      };
    default:
      return {
        label: 'Operational Event',
        icon: Bell,
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
      };
  }
}

function getSeverityBadge(severity: NotificationSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-600 text-white';
    case 'WARNING':
      return 'bg-amber-500 text-white';
    case 'INFO':
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const currentOrg = useCurrentOrganization();

  const {
    data: allNotifications = [],
    isLoading,
    error,
    refetch,
  } = useNotifications(unreadOnly);

  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.unread_count ?? 0;

  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const currentOrgId = currentOrg?.id ?? null;

  // Tenant Isolation: Filter notifications belonging to active organization if organization field exists
  const visibleNotifications = useMemo(() => {
    if (!currentOrgId) return allNotifications;
    return allNotifications.filter((item) => {
      if (!item.organization) return true; // If backend did not include org ID, show it
      return item.organization === currentOrgId;
    });
  }, [allNotifications, currentOrgId]);

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

  const handleMarkRead = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    markRead.mutate({ id, read: true });
  };

  const handleMarkAllRead = () => {
    markAll.mutate();
  };

  // Click on notification to navigate to the incident
  const handleNotificationClick = useCallback(
    async (notification: NotificationItem) => {
      // 1. Mark as read immediately if not already read
      if (!notification.is_read) {
        markRead.mutate({ id: notification.id, read: true });
      }

      // 2. Determine target incident ID
      let targetIncidentId = notification.incident_id;

      // If incident_id is not populated on list item, fetch detail from API
      if (!targetIncidentId) {
        try {
          setNavigatingId(notification.id);
          const detail = await getNotification(notification.id);
          targetIncidentId = detail.incident_id;
          // Verify tenant isolation
          if (detail.organization && currentOrgId && detail.organization !== currentOrgId) {
            setNavigatingId(null);
            return;
          }
        } catch (err) {
          console.error('Failed to fetch notification detail for navigation:', err);
        } finally {
          setNavigatingId(null);
        }
      }

      // 3. Navigate if incident reference exists
      if (targetIncidentId) {
        setIsOpen(false);
        navigate(`/app/incidents/${targetIncidentId}`);
      }
    },
    [currentOrgId, markRead, navigate]
  );

  return (
    <div className="relative" ref={containerRef}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative px-2 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-live="polite"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="sr-only">unread notifications</span>
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-88 sm:w-96 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden focus:outline-none"
          role="dialog"
          aria-label="Notification Center"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setUnreadOnly((v) => !v)}
                aria-pressed={unreadOnly}
              >
                {unreadOnly ? 'Show All' : 'Unread Only'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleMarkAllRead}
                disabled={markAll.isPending || unreadCount === 0}
                aria-label="Mark all notifications as read"
                title="Mark all as read"
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
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {isLoading && (
              <div
                className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
                <span>Loading notifications...</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center" role="alert">
                <AlertCircle className="h-6 w-6 text-destructive mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-destructive">Failed to load notifications</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  {error instanceof Error ? error.message : 'Unable to connect to notification service.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !error && visibleNotifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                  <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {unreadOnly ? 'No unread notifications' : 'All caught up'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {unreadOnly
                    ? 'You have read all your incident and operational alerts.'
                    : 'No operational notifications for this organization.'}
                </p>
              </div>
            )}

            {!isLoading && !error && visibleNotifications.length > 0 && (
              <ul className="divide-y divide-border" role="list" aria-label="Notifications list">
                {visibleNotifications.map((notification) => {
                  const typeMeta = getNotificationTypeMeta(notification.notification_type);
                  const IconComponent = typeMeta.icon;
                  const isNavigating = navigatingId === notification.id;

                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        disabled={isNavigating}
                        className={cn(
                          'group flex w-full items-start gap-3 p-3.5 text-left transition-colors',
                          'hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent',
                          !notification.is_read ? 'bg-primary/[0.04]' : 'bg-card'
                        )}
                        aria-label={`${notification.title}, ${typeMeta.label}, ${
                          notification.is_read ? 'read' : 'unread'
                        }`}
                      >
                        {/* Unread Indicator & Type Icon */}
                        <div className="relative mt-0.5 shrink-0">
                          <div
                            className={cn(
                              'h-8 w-8 rounded-lg flex items-center justify-center border',
                              typeMeta.badgeClass
                            )}
                          >
                            <IconComponent className="h-4 w-4" aria-hidden="true" />
                          </div>
                          {!notification.is_read && (
                            <span
                              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card"
                              title="Unread notification"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        {/* Notification Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              {typeMeta.label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {notification.severity && (
                                <span
                                  className={cn(
                                    'px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider',
                                    getSeverityBadge(notification.severity)
                                  )}
                                >
                                  {notification.severity}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {formatRelativeTime(notification.created_at)}
                              </span>
                            </div>
                          </div>

                          <p
                            className={cn(
                              'text-sm leading-snug',
                              !notification.is_read
                                ? 'font-semibold text-foreground'
                                : 'font-normal text-muted-foreground'
                            )}
                          >
                            {notification.title}
                          </p>

                          {notification.message && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {notification.message}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium group-hover:underline">
                              {isNavigating ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                  Opening...
                                </>
                              ) : (
                                <>
                                  <span>Open incident</span>
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </>
                              )}
                            </span>

                            {!notification.is_read && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => handleMarkRead(notification.id, e)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    handleMarkRead(notification.id);
                                  }
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline"
                                title="Mark as read"
                              >
                                Mark as read
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
