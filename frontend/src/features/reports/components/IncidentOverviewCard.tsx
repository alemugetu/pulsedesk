import {
  AlertTriangle,
  CircleCheckBig,
  CircleX,
  Flame,
  UserX,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { cn } from '../../../utils/cn';
import type { IncidentSummaryResponse } from '../types/report.types';

interface IncidentOverviewCardProps {
  data: IncidentSummaryResponse;
}

const metrics = [
  { key: 'total_incidents', label: 'Total Incidents', icon: Flame, tone: 'neutral' as const },
  { key: 'open_incidents', label: 'Open Incidents', icon: AlertTriangle, tone: 'warning' as const },
  { key: 'resolved_incidents', label: 'Resolved Incidents', icon: CircleCheckBig, tone: 'success' as const },
  { key: 'closed_incidents', label: 'Closed Incidents', icon: CircleX, tone: 'neutral' as const },
  { key: 'unassigned_incidents', label: 'Unassigned Incidents', icon: UserX, tone: 'warning' as const },
  { key: 'critical_incidents', label: 'Critical Incidents', icon: AlertTriangle, tone: 'critical' as const },
];

export function IncidentOverviewCard({ data }: IncidentOverviewCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const value = data[metric.key as keyof IncidentSummaryResponse] as number;
        return (
          <Card key={metric.key} className="p-5">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                  metric.tone === 'critical' && 'text-red-500 bg-red-500/10',
                  metric.tone === 'warning' && 'text-amber-500 bg-amber-500/10',
                  metric.tone === 'success' && 'text-green-500 bg-green-500/10',
                  metric.tone === 'neutral' && 'text-primary bg-primary/10'
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                  {new Intl.NumberFormat('en-US').format(value)}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

