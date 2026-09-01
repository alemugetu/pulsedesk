import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { IncidentsByStatusResponse } from '../types/report.types';

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#6366f1',
  ACKNOWLEDGED: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#10b981',
  CLOSED: '#94a3b8',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

interface IncidentStatusChartProps {
  data?: IncidentsByStatusResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function IncidentStatusChart({ data, isLoading, error, onRetry }: IncidentStatusChartProps) {
  const chartData = data
    ? Object.entries(data).map(([key, value]) => ({
        key,
        label: STATUS_LABELS[key] || key,
        value,
      }))
    : [];

  const isEmpty = chartData.every((item) => item.value === 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
          Incidents by Status
        </h2>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-red-500" role="alert">
              {error.message}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {!error && isLoading && (
          <div className="flex items-center justify-center py-10">
            <span className="text-sm text-muted-foreground">Loading status distribution...</span>
          </div>
        )}

        {!error && !isLoading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-lg font-semibold text-foreground">No incident status data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No incidents exist for this organization in the selected date range.
            </p>
          </div>
        )}

        {!error && !isLoading && !isEmpty && (
          <>
            <div className="sr-only">
              <h3>Data table for Incidents by Status</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((item) => (
                    <tr key={item.key}>
                      <td>{item.label}</td>
                      <td>{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div aria-hidden="true">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} className="text-muted-foreground" />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

