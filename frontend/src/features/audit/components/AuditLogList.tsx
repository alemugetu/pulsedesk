/**
 * AuditLogList — audit log list with loading, error, empty, and success states.
 *
 * Orchestrates the state transitions for the audit feed:
 * - Loading: skeleton rows
 * - Error: meaningful message + retry
 * - Empty: dedicated AuditLogEmptyState (respects active filters)
 * - Success: real backend records wrapped in AuditLogItem rows
 */

import type { AuditLog } from '../types/audit.types';
import { AuditLogItem } from './AuditLogItem';
import { AuditLogEmptyState } from './AuditLogEmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';

interface AuditLogListProps {
  logs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  hasActiveFilters?: boolean;
  selectedLogId?: string | null;
  onSelect: (log: AuditLog) => void;
  onRetry: () => void;
  className?: string;
}

export function AuditLogList({
  logs,
  isLoading,
  error,
  hasActiveFilters = false,
  selectedLogId = null,
  onSelect,
  onRetry,
  className = '',
}: AuditLogListProps) {
  if (isLoading) {
    return (
      <div
        className={`space-y-2 ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Loading audit logs"
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-border bg-card/60"
          />
        ))}
        <span className="sr-only">Loading audit logs</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <ErrorState
          title="Failed to load audit logs"
          description={error}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={`${className}`}>
        <AuditLogEmptyState hasActiveFilters={hasActiveFilters} />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <ul className="space-y-2" role="list" aria-label="Audit log records">
        {logs.map((log) => (
          <li key={log.id}>
            <AuditLogItem
              log={log}
              onClick={() => onSelect(log)}
              active={selectedLogId === log.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}