import { GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { EscalationActivityResponse } from '../types/report.types';

interface EscalationMetricsCardProps {
  data?: EscalationActivityResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function EscalationMetricsCard({ data, isLoading, error, onRetry }: EscalationMetricsCardProps) {
  const byLevelData = data
    ? Object.entries(data.by_level).map(([key, value]) => ({
        label: `Level ${key}`,
        value,
      }))
    : [];

  const byTriggerData = data
    ? Object.entries(data.by_trigger_type).map(([key, value]) => ({
        label: key,
        value,
      }))
    : [];

  const isEmpty = data && data.total_escalation_events === 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <GitBranch className="h-5 w-5 text-primary" aria-hidden="true" />
          Escalation Activity
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
            <span className="text-sm text-muted-foreground">Loading escalation activity...</span>
          </div>
        )}

        {!error && !isLoading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-lg font-semibold text-foreground">No escalation activity</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No escalation events exist for this organization in the selected date range.
            </p>
          </div>
        )}

        {!error && !isLoading && !isEmpty && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Metric label="Total Events" value={data.total_escalation_events} />
              <Metric label="By Level" value={`${Object.keys(data.by_level).length} levels`} />
              <Metric label="By Trigger Type" value={`${Object.keys(data.by_trigger_type).length} types`} />
            </div>

            {byLevelData.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">By Level</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byLevelData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {byTriggerData.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">By Trigger Type</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byTriggerData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

