/**
 * IncidentStatusChart component.
 *
 * Renders the incident distribution by status as an accessible, responsive
 * horizontal bar chart.
 *
 * The backend does not expose a status-distribution endpoint, so the counts
 * come from getIncidentStatusDistribution, which derives exact per-status
 * totals from the authoritative dashboard incidents API. No chart data is
 * fabricated. The project has no charting library, so this is a lightweight
 * CSS/SVG-free bar chart built with Tailwind + real counts (no new library).
 */

import { BarChartHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { getStatusDisplayText, getStatusColorClass, getStatusTextColorClass } from '../../incidents/utils/incidentUtils';
import type { IncidentStatus } from '../../incidents/types/incident.types';
import { useOperationsStatusDistribution } from '../hooks/useOperationsStatusDistribution';
import { OperationsEmptyState } from './OperationsEmptyState';
import { OperationsErrorState } from './OperationsErrorState';
import type { IncidentStatusDistribution } from '../types/operations.types';

const STATUS_ORDER: readonly IncidentStatus[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

interface BarRow {
  key: string;
  label: string;
  value: number;
  barClass: string;
  textClass: string;
}

function buildRows(data: IncidentStatusDistribution): BarRow[] {
  return STATUS_ORDER.map((status) => ({
    key: status,
    label: getStatusDisplayText(status),
    value: data[status],
    barClass: getStatusColorClass(status),
    textClass: getStatusTextColorClass(status),
  }));
}

function isEmpty(rows: BarRow[]): boolean {
  return rows.every((row) => row.value === 0);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function IncidentStatusChart() {
  const { data, isLoading, error, refetch } = useOperationsStatusDistribution();

  const rows = data ? buildRows(data) : [];
  const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <BarChartHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
          Incidents by Status
        </h2>
      </CardHeader>
      <CardContent>
        {error && (
          <OperationsErrorState description={getErrorMessage(error)} onRetry={() => void refetch()} />
        )}

        {!error && isLoading && (
          <div className="flex items-center justify-center py-10">
            <span className="text-sm text-muted-foreground">Loading status distribution...</span>
          </div>
        )}

        {!error && !isLoading && rows.length > 0 && isEmpty(rows) && (
          <OperationsEmptyState
            title="No incident status data"
            description="No incidents exist for this organization."
          />
        )}

        {!error && !isLoading && rows.length > 0 && !isEmpty(rows) && (
          <ul
            className="space-y-4"
            role="img"
            aria-label={`Incident status distribution: ${rows
              .map((row) => `${row.label}: ${row.value}`)
              .join(', ')}`}
          >
            {rows.map((row) => (
              <li key={row.key}>
                <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                  <span className={row.textClass}>{row.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {new Intl.NumberFormat('en-US').format(row.value)}
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full rounded-full ${row.barClass}`}
                    style={{ width: max > 0 ? `${(row.value / max) * 100}%` : '0%' }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}