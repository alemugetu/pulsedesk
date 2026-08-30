/**
 * AuditLogItem — represents a single audit record in the list.
 *
 * Shows: who (actor), what (action), what resource was affected,
 * when it happened, and any safe `changes` summary from the backend.
 * Uses lucide icons to reinforce meaning; text remains the source of truth.
 */

import { type ReactElement } from 'react';
import { ChevronRight, CircleAlert, Settings, Timer, TrendingUp, MessageSquare, Paperclip, Users, Shield, Box } from 'lucide-react';
import type { AuditAction, AuditLog } from '../types/audit.types';
import {
  formatActorName,
  formatAuditRelativeTime,
  formatResourceType,
  getAuditActionLabel,
  isSystemEvent,
  summarizeChanges,
} from '../utils/auditUtils';

interface AuditLogItemProps {
  log: AuditLog;
  onClick: () => void;
  active?: boolean;
  className?: string;
}

/**
 * Action-group icon rendering. Icons reinforce meaning but, per the project's
 * lint rules, icons are rendered as elements (never components created during
 * render). Text remains the source of truth.
 */
function renderActionIcon(action: AuditAction | string, className: string): ReactElement {
  if (action.startsWith('incident')) return <CircleAlert className={className} />;
  if (action.startsWith('comment')) return <MessageSquare className={className} />;
  if (action.startsWith('attachment')) return <Paperclip className={className} />;
  if (action.startsWith('member')) return <Users className={className} />;
  if (action.startsWith('role')) return <Shield className={className} />;
  if (action.startsWith('sla')) return <Timer className={className} />;
  if (action.startsWith('escalation')) return <TrendingUp className={className} />;
  if (action.startsWith('settings')) return <Settings className={className} />;
  return <Box className={className} />;
}

export function AuditLogItem({ log, onClick, active = false, className = '' }: AuditLogItemProps) {
  const actorLabel = formatActorName(log.actor);
  const actionLabel = getAuditActionLabel(log.action);
  const changesSummary = summarizeChanges(log.changes);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View audit log: ${actionLabel}`}
      aria-pressed={active}
      className={`w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset ${active ? 'border-primary bg-accent' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            {renderActionIcon(log.action, 'h-5 w-5')}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{actionLabel}</p>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {isSystemEvent(log) ? (
                <span>System-generated event</span>
              ) : (
                <span>
                  by <span className="font-medium text-foreground">{actorLabel}</span>
                </span>
              )}{' '}
              · <span className="font-medium text-foreground">{formatResourceType(log.resource_type)}</span>{' '}
              {log.resource_id}
            </p>

            {changesSummary && (
              <p className="mt-1 truncate text-xs text-muted-foreground" title={changesSummary}>
                {changesSummary}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <time dateTime={log.created_at} className="text-xs text-muted-foreground">
            {formatAuditRelativeTime(log.created_at)}
          </time>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    </button>
  );
}