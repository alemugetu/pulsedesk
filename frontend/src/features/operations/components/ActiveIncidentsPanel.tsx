/**
 * ActiveIncidentsPanel component.
 *
 * Displays the most recently created active incidents (OPEN, ACKNOWLEDGED,
 * IN_PROGRESS) composed from the real backend dashboard incidents API.
 */

import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { useOperationsActiveIncidents } from '../hooks/useOperationsActiveIncidents';
import { DashboardIncidentList } from './DashboardIncidentList';

export function ActiveIncidentsPanel() {
  const { data = [], isLoading, error, refetch } = useOperationsActiveIncidents(5);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          Active Incidents
        </h2>
      </CardHeader>
      <CardContent>
        <DashboardIncidentList
          incidents={data}
          isLoading={isLoading}
          error={error ? (error instanceof Error ? error.message : String(error)) : null}
          onRetry={() => void refetch()}
          emptyTitle="No active incidents"
          emptyDescription="There are no open, acknowledged, or in-progress incidents right now."
        />
      </CardContent>
    </Card>
  );
}