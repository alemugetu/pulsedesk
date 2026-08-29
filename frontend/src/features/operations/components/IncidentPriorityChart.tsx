/**
 * IncidentPriorityChart component.
 *
 * Renders the incident distribution by priority as an accessible, responsive
 * horizontal bar chart.
 *
 * Data comes from the authoritative backend endpoint
 * GET .../dashboard/priority-distribution/. The backend maps low=P4,
 * medium=P3, high=P2, critical=P1 (PriorityDistributionSerializer). No chart
 * data is fabricated. No charting library exists in the project, so this is a
 * lightweight Tailwind-based bar chart (no new library introduced).
 */

import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { useOperationsPriorityDistribution } from '../hooks/useOperationsPriorityDistribution';
import { OperationsEmptyState } from './OperationsEmptyState';
import { OperationsErrorState } from './OperationsErrorState';
import type { PriorityDistribution } from '../types/operations.types';

interface BarRow {
  key: string;
  label: string;
  value: number;
  barClass: string;
  textClass: string;
}

function buildRows(data: PriorityDistribution): BarRow[] {
  return [
    { key: 'critical', label: 'Critical', value: data.critical, barClass: 'bg-red-500', textClass: 'text-red-400' },
    { key: 'high', label: 'High', value: data.high, barClass: 'bg-orange-500', textClass: 'text-orange-400' },
    { key: 'medium', label: 'Medium', value: data.medium, barClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
    { key: 'low', label: 'Low', value: data.low, barClass: 'bg-blue-500', textClass: 'text-blue-400' },
  ];
}

function isEmpty(rows: BarRow[]): boolean {
  return rows.every((row) => row.value === 0);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function IncidentPriorityChart() {
  const { data, isLoading, error, refetch } = useOperationsPriorityDistribution();

  const rows = data ? buildRows(data) : [];
  const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
          Incidents by Priority
        </h2>
      </CardHeader>
      <CardContent>
        {error && (
          <OperationsErrorState description={getErrorMessage(error)} onRetry={() => void refetch()} />
        )}

        {!error && isLoading && (
          <div className="flex items-center justify-center py-10">
            <span className="text-sm text-muted-foreground">Loading priority distribution...</span>
          </div>
        )}

        {!error && !isLoading && rows.length > 0 && isEmpty(rows) && (
          <OperationsEmptyState
            title="No priority data"
            description="No incidents exist for this organization."
          />
        )}

        {!error && !isLoading && rows.length > 0 && !isEmpty(rows) && (
          <ul
            className="space-y-4"
            role="img"
            aria-label={`Incident priority distribution: ${rows
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