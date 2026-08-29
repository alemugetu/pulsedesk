/**
 * IncidentMetricCard component.
 *
 * Displays a single operational metric with icon, label, value, tone, and an
 * optional navigation link to the relevant incident view.
 */

import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { cn } from '../../../utils/cn';

export type IncidentMetricTone = 'neutral' | 'warning' | 'critical' | 'success';

/**
 * Metric definition consumed by IncidentMetricsGrid.
 */
export interface IncidentMetricData {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: IncidentMetricTone;
  href?: string;
}

interface IncidentMetricCardProps {
  metric: IncidentMetricData;
}

const toneStyles: Record<IncidentMetricTone, { icon: string; accent: string }> = {
  neutral: { icon: 'text-primary bg-primary/10', accent: 'bg-primary' },
  warning: { icon: 'text-amber-500 bg-amber-500/10', accent: 'bg-amber-500' },
  critical: { icon: 'text-red-500 bg-red-500/10', accent: 'bg-red-500' },
  success: { icon: 'text-green-500 bg-green-500/10', accent: 'bg-green-500' },
};

function formatValue(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function getLinkLabel(label: string): string {
  const base = label.toLowerCase().replace(/\s+incidents$/i, '').trim();
  return `View ${base} incidents`;
}

export function IncidentMetricCard({ metric }: IncidentMetricCardProps) {
  const Icon = metric.icon;
  const tone = metric.tone ?? 'neutral';
  const toneStyle = toneStyles[tone];

  const content = (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
          toneStyle.icon
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
          {formatValue(metric.value)}
        </p>
      </div>
    </div>
  );

  if (metric.href) {
    return (
      <Card
        className={cn(
          'group relative overflow-hidden p-5 transition-colors',
          'hover:bg-accent/60 focus-within:ring-2 focus-within:ring-ring'
        )}
      >
        <Link
          to={metric.href}
          className="absolute inset-0 z-10 rounded-lg"
          aria-label={getLinkLabel(metric.label)}
        >
          <span className="sr-only">{getLinkLabel(metric.label)}</span>
        </Link>
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-1 opacity-0 transition-opacity group-hover:opacity-100',
            toneStyle.accent
          )}
          aria-hidden="true"
        />
        {content}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
            toneStyle.icon
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            {formatValue(metric.value)}
          </p>
        </div>
      </div>
    </Card>
  );
}