/**
 * AuditLogEmptyState — dedicated empty state for the audit log list.
 *
 * Distinguishes between:
 * - No audit records exist at all
 * - No records match the current (backend-supported) filters
 *
 * Never shown when the request actually failed — that is handled by the
 * error state.
 */

import { ScrollText, SlidersHorizontal } from 'lucide-react';

interface AuditLogEmptyStateProps {
  /** Whether backend-supported filters are currently active */
  hasActiveFilters?: boolean;
  className?: string;
}

export function AuditLogEmptyState({
  hasActiveFilters = false,
  className = '',
}: AuditLogEmptyStateProps) {
  const Icon = hasActiveFilters ? SlidersHorizontal : ScrollText;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-10 text-center ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-semibold text-foreground">
        {hasActiveFilters ? 'No matching audit records' : 'No audit records yet'}
      </h3>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {hasActiveFilters
          ? 'No audit log entries match the current filters. Try adjusting or clearing the filters.'
          : 'Audit records will appear here as actions are performed across your organization.'}
      </p>
    </div>
  );
}