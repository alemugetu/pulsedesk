/**
 * RecentIncidentsPanel component.
 *
 * Displays the most recently created incidents for the organization using the
 * real backend dashboard incidents API (no status/priority filter).
 */

import { Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { useOperationsIncidents } from '../hooks/useOperationsIncidents';
import { DashboardIncidentList } from './DashboardIncidentList';

export function RecentIncidentsPanel() {
  const { data, isLoading, error, refetch } = useOperationsIncidents({
    ordering: '-created_at',
    page_size: 5,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock3 className="h-5 w-5 text-primary" aria-hidden="true" />
          Recent Incidents
        </h2>
      </CardHeader>
      <CardContent>
        <DashboardIncidentList
          incidents={data?.results ?? []}
          isLoading={isLoading}
          error={error ? (error instanceof Error ? error.message : String(error)) : null}
          onRetry={() => void refetch()}
          emptyTitle="No recent incidents"
          emptyDescription="No incidents have been created yet for this organization."
        />
      </CardContent>
    </Card>
  );
}