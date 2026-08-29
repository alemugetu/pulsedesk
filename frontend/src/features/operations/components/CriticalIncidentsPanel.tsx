/**
 * CriticalIncidentsPanel component.
 *
 * Displays the most recently created critical (P1) incidents using the real
 * backend dashboard incidents API filtered by priority. "Critical" maps to
 * priority P1 — the authoritative backend mapping used by the
 * PriorityDistributionSerializer.
 */

import { Flame } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { useOperationsIncidents } from '../hooks/useOperationsIncidents';
import { DashboardIncidentList } from './DashboardIncidentList';

const CRITICAL_PRIORITY = 'P1' as const;

export function CriticalIncidentsPanel() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useOperationsIncidents({
    priority: CRITICAL_PRIORITY,
    ordering: '-created_at',
    page_size: 5,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Flame className="h-5 w-5 text-red-500" aria-hidden="true" />
          Critical Incidents
        </h2>
      </CardHeader>
      <CardContent>
        <DashboardIncidentList
          incidents={data?.results ?? []}
          isLoading={isLoading}
          error={error ? (error instanceof Error ? error.message : String(error)) : null}
          onRetry={() => void refetch()}
          emptyTitle="No critical incidents"
          emptyDescription="There are no P1 incidents for this organization."
        />
      </CardContent>
    </Card>
  );
}