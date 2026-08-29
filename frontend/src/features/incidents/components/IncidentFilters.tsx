/**
 * IncidentFilters component.
 * 
 * Provides filter controls for incident list.
 * Supports status, priority, assignee, and category filters.
 */

import type { IncidentStatus, IncidentPriority } from '../types/incident.types';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { X } from 'lucide-react';

interface IncidentFiltersProps {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assignee?: string;
  category?: string;
  onStatusChange: (status: IncidentStatus | undefined) => void;
  onPriorityChange: (priority: IncidentPriority | undefined) => void;
  onAssigneeChange: (assignee: string | undefined) => void;
  onCategoryChange: (category: string | undefined) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Priorities' },
  { value: 'P1', label: 'P1 — Critical' },
  { value: 'P2', label: 'P2 — High' },
  { value: 'P3', label: 'P3 — Medium' },
  { value: 'P4', label: 'P4 — Low' },
];

export function IncidentFilters({
  status,
  priority,
  assignee,
  category,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onCategoryChange,
  onClearFilters,
  hasActiveFilters,
  className = '',
}: IncidentFiltersProps) {
  return (
    <div className={`flex flex-wrap gap-3 items-center ${className}`}>
      <Select
        value={status || ''}
        onChange={(e) => onStatusChange((e.target.value as IncidentStatus) || undefined)}
        label="Status"
        options={STATUS_OPTIONS}
        className="w-40"
      />

      <Select
        value={priority || ''}
        onChange={(e) => onPriorityChange((e.target.value as IncidentPriority) || undefined)}
        label="Priority"
        options={PRIORITY_OPTIONS}
        className="w-40"
      />

      {assignee && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md">
          <span className="text-sm">Assignee: {assignee}</span>
          <button
            onClick={() => onAssigneeChange(undefined)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear assignee filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {category && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md">
          <span className="text-sm">Category: {category}</span>
          <button
            onClick={() => onCategoryChange(undefined)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear category filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="ml-auto"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}
