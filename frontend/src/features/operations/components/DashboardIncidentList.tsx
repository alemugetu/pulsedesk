/**
 * DashboardIncidentList component.
 *
 * Presentational list of dashboard incidents shared by the Active, Critical,
 * and Recent incident panels. Every row links to the existing Incident Detail
 * page — no incident detail functionality is duplicated.
 */

import { Link } from 'react-router-dom';
import { ChevronRight, Inbox } from 'lucide-react';
import { IncidentStatusBadge } from '../../incidents/components/IncidentStatusBadge';
import { IncidentPriorityBadge } from '../../incidents/components/IncidentPriorityBadge';
import { formatDate } from '../../incidents/utils/incidentUtils';
import { cn } from '../../../utils/cn';
import { OperationsEmptyState } from './OperationsEmptyState';
import { OperationsErrorState } from './OperationsErrorState';
import type { DashboardIncident } from '../types/operations.types';

interface DashboardIncidentListProps {
  incidents: DashboardIncident[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

function getErrorMessage(error: string | Error): string {
  return error instanceof Error ? error.message : String(error);
}

function IncidentRow({ incident }: { incident: DashboardIncident }) {
  const slaLabel =
    incident.sla_state === 'BREACHED'
      ? 'SLA breached'
      : incident.sla_state === 'AT_RISK'
        ? 'SLA at risk'
        : null;

  return (
    <Link
      to={`/app/incidents/${incident.id}`}
      className={cn(
        'group flex items-start justify-between gap-3 p-4 rounded-lg border border-border bg-card',
        'transition-colors hover:bg-accent/60',
        'focus:outline-none focus:ring-2 focus:ring-ring'
      )}
      aria-label={`View incident ${incident.incident_number}: ${incident.title}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground">
            {incident.incident_number}
          </span>
          <IncidentStatusBadge status={incident.status} />
          <IncidentPriorityBadge priority={incident.priority} />
        </div>
        <h3 className="mt-1.5 truncate text-base font-semibold text-foreground">
          {incident.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDate(incident.created_at)}</span>
          <span>{incident.assignee_email ?? 'Unassigned'}</span>
          {slaLabel && (
            <span
              className={cn(
                'font-medium',
                incident.sla_state === 'BREACHED' ? 'text-red-500' : 'text-amber-500'
              )}
            >
              {slaLabel}
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex animate-pulse items-center gap-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded-full bg-muted" />
            <div className="h-4 w-16 rounded-full bg-muted" />
          </div>
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function DashboardIncidentList({
  incidents,
  isLoading,
  error,
  onRetry,
  emptyTitle = 'No incidents to display',
  emptyDescription = 'There are no incidents matching the current operational view.',
  className,
}: DashboardIncidentListProps) {
  if (error) {
    return <OperationsErrorState description={getErrorMessage(error)} onRetry={onRetry} />;
  }

  if (isLoading) {
    return <SkeletonRows />;
  }

  if (incidents.length === 0) {
    return (
      <OperationsEmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<Inbox className="h-8 w-8" aria-hidden="true" />}
      />
    );
  }

  return (
    <ul className={cn('space-y-3', className)} role="list">
      {incidents.map((incident) => (
        <li key={incident.id}>
          <IncidentRow incident={incident} />
        </li>
      ))}
    </ul>
  );
}