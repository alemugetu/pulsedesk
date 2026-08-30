/**
 * AuditLogFilters — filter controls for the audit log list.
 *
 * Only backend-supported query parameters are exposed:
 *   action, resource_type, resource_id, actor_id, date_from, date_to.
 *
 * Every filter below maps 1:1 to a documented backend query parameter.
 */

import { X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { AUDIT_ACTIONS, type AuditLogFilters } from '../types/audit.types';
import { getAuditActionLabel } from '../utils/auditUtils';
import { formatDateForApi, formatDateForInput } from '../utils/auditUtils';

interface AuditLogFiltersProps {
  filters: AuditLogFilters;
  onChange: (filters: AuditLogFilters) => void;
  onClear: () => void;
  className?: string;
}

/**
 * All possible action choices, as SelectOptions for the action dropdown.
 */
const ACTION_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Actions' },
  ...AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: getAuditActionLabel(action),
  })),
];

export function AuditLogFilters({
  filters,
  onChange,
  onClear,
  className = '',
}: AuditLogFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== ''
  );

  const set = (patch: Partial<AuditLogFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Action"
          value={filters.action ?? ''}
          onChange={(e) => set({ action: e.target.value || undefined })}
          options={ACTION_OPTIONS}
          aria-label="Filter by action"
        />

        <Input
          label="Resource type"
          value={filters.resource_type ?? ''}
          onChange={(e) => set({ resource_type: e.target.value || undefined })}
          placeholder="e.g. incident"
          aria-label="Filter by resource type"
        />

        <Input
          label="Resource ID"
          value={filters.resource_id ?? ''}
          onChange={(e) => set({ resource_id: e.target.value || undefined })}
          placeholder="Resource UUID"
          aria-label="Filter by resource ID"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Actor (user ID)"
          value={filters.actor_id ?? ''}
          onChange={(e) => set({ actor_id: e.target.value || undefined })}
          placeholder="User UUID"
          aria-label="Filter by actor user ID"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-date-from" className="text-sm font-medium text-foreground">
            From
          </label>
          <input
            id="audit-date-from"
            type="datetime-local"
            value={formatDateForInput(filters.date_from)}
            onChange={(e) => set({ date_from: formatDateForApi(e.target.value) })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter by start date"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-date-to" className="text-sm font-medium text-foreground">
            To
          </label>
          <input
            id="audit-date-to"
            type="datetime-local"
            value={formatDateForInput(filters.date_to)}
            onChange={(e) => set({ date_to: formatDateForApi(e.target.value) })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter by end date"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="self-start">
          <X className="mr-1 h-4 w-4" aria-hidden="true" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}