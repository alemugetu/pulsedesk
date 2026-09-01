import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { IncidentTrendResponse } from '../types/report.types';

interface IncidentTrendChartProps {
  data?: IncidentTrendResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function IncidentTrendChart({ data, isLoading, error, onRetry }: IncidentTrendChartProps) {
  const chartData = data?.data.map((point: { date?: string; week?: string; count: number }) => ({
    label: point.date || point.week || '',
    count: point.count,
  })) ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
          Incident Trend
          {data?.granularity && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({data.granularity})
            </span>
          )}
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
            <span className="text-sm text-muted-foreground">Loading trend data...</span>
          </div>
        )}

        {!error && !isLoading && chartData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-lg font-semibold text-foreground">No trend data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No incidents exist for this organization in the selected date range.
            </p>
          </div>
        )}

        {!error && !isLoading && chartData.length > 0 && (
          <>
            <div className="sr-only">
              <h3>Data table for Incident Trend</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Time Period</th>
                    <th scope="col">Incident Count</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((point) => (
                    <tr key={point.label}>
                      <td>{point.label}</td>
                      <td>{point.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div aria-hidden="true" className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

