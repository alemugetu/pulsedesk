import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { SLAPerformanceResponse } from '../types/report.types';

interface SLAMetricsCardProps {
  data?: SLAPerformanceResponse;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const COLORS = ['#10b981', '#ef4444'];

export function SLAMetricsCard({ data, isLoading, error, onRetry }: SLAMetricsCardProps) {
  const pieData = data
    ? [
        { name: 'Compliant', value: data.compliant_incidents },
        { name: 'Breached', value: data.breached_incidents },
      ]
    : [];

  const hasData = data && (data.compliant_incidents > 0 || data.breached_incidents > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          SLA Performance
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
            <span className="text-sm text-muted-foreground">Loading SLA performance...</span>
          </div>
        )}

        {!error && !isLoading && !data && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-lg font-semibold text-foreground">No SLA data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No SLA data is available for this organization in the selected date range.
            </p>
          </div>
        )}

        {!error && !isLoading && data && !hasData && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-lg font-semibold text-foreground">No SLA breaches or compliant records</p>
            <p className="mt-1 text-sm text-muted-foreground">
              SLA data exists but no incidents have been evaluated yet.
            </p>
          </div>
        )}

        {!error && !isLoading && data && hasData && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Total SLA Incidents" value={data.total_sla_incidents} />
              <Metric label="Compliant" value={data.compliant_incidents} tone="success" />
              <Metric label="Breached" value={data.breached_incidents} tone="critical" />
              <Metric label="Completed Records" value={data.completed_sla_records} />
              <Metric label="Compliance %" value={`${data.compliance_percentage.toFixed(1)}%`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'success' | 'critical';
}) {
  const toneClass = tone === 'critical' ? 'text-red-500' : tone === 'success' ? 'text-green-500' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

