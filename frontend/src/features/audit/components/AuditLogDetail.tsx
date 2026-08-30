/**
 * AuditLogDetail — complete backend-supported audit record.
 *
 * Renders every field the backend serializer exposes for a single record:
 * id, organization, actor (or system), action, resource_type, resource_id,
 * changes (safe metadata), ip_address, created_at.
 *
 * Only values present in the backend contract are displayed. No sensitive
 * information is assumed or fabricated.
 */

import { type ReactElement } from 'react';
import { X, Box, CircleAlert, MessageSquare, Paperclip, Settings, Shield, Timer, TrendingUp, Users, User } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { ErrorState } from '../../../components/ui/ErrorState';
import type { AuditLog, AuditLogChanges } from '../types/audit.types';
import {
  formatActorName,
  formatAuditTimestamp,
  formatIpAddress,
  formatResourceType,
  getAuditActionLabel,
  isSystemEvent,
} from '../utils/auditUtils';

interface AuditLogDetailProps {
  log: AuditLog | null | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * Action-group icon rendering (elements, not components — see repo lint rule).
 */
function renderActionIcon(action: AuditLog['action'] | string, className: string): ReactElement {
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

export function AuditLogDetail({
  log,
  isLoading,
  error,
  onRetry,
  onClose,
  className = '',
}: AuditLogDetailProps) {
  if (isLoading && !log) {
    return (
      <Card className={`p-8 ${className}`}>
        <Loading text="Loading audit record..." />
      </Card>
    );
  }

  if (error && !log) {
    return (
      <Card className={`p-4 ${className}`}>
        <ErrorState
          title="Failed to load audit record"
          description={error}
          onRetry={onRetry}
        />
      </Card>
    );
  }

  if (!log) {
    return (
      <Card className={`p-8 ${className}`}>
        <p className="text-center text-sm text-muted-foreground">
          Select an audit record to view its full details.
        </p>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {renderActionIcon(log.action, 'h-5 w-5')}
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {getAuditActionLabel(log.action)}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{log.action}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close audit record details">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <dl className="divide-y divide-border p-5 text-sm">
        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-muted-foreground">Performed by</dt>
          <dd className="flex items-center gap-2 font-medium text-foreground">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {isSystemEvent(log) ? (
              'System (automated)'
            ) : (
              <span>
                {formatActorName(log.actor)} <span className="text-muted-foreground">({log.actor?.email})</span>
              </span>
            )}
          </dd>
        </div>

        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-muted-foreground">Timestamp</dt>
          <dd className="font-medium text-foreground">
            <time dateTime={log.created_at}>{formatAuditTimestamp(log.created_at)}</time>
          </dd>
        </div>

        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-muted-foreground">Resource</dt>
          <dd className="min-w-0 text-foreground">
            <span className="font-medium">{formatResourceType(log.resource_type)}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground break-all">{log.resource_id}</span>
          </dd>
        </div>

        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-muted-foreground">IP address</dt>
          <dd className="font-medium text-foreground">{formatIpAddress(log.ip_address)}</dd>
        </div>

        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-muted-foreground">Organization</dt>
          <dd className="font-mono text-xs text-foreground break-all">{log.organization}</dd>
        </div>

        <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-muted-foreground">Record ID</dt>
          <dd className="font-mono text-xs text-foreground break-all">{log.id}</dd>
        </div>
      </dl>

      <div className="border-t border-border p-5">
        <h3 className="text-sm font-semibold text-foreground">Changes</h3>
        {hasChanges(log.changes) ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground">
            {JSON.stringify(log.changes, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No change metadata recorded.</p>
        )}
      </div>
    </Card>
  );
}

function hasChanges(changes: AuditLogChanges | undefined | null): boolean {
  return !!changes && Object.keys(changes).length > 0;
}