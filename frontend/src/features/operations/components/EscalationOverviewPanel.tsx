/**
 * EscalationOverviewPanel component.
 *
 * Displays backend-computed escalation metrics
 * (GET .../dashboard/escalation-metrics/).
 * Read-only overview — escalation evaluation/processing is backend-owned
 * (and Phase 13.10 real-time updates are out of scope here).
 */

import { Siren, CheckCircle2, Ban, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { cn } from '../../../utils/cn';
import { useOperationsEscalations } from '../hooks/useOperationsEscalations';
import { OperationsEmptyState } from './OperationsEmptyState';
import { OperationsErrorState } from './OperationsErrorState';
import type { EscalationMetrics } from '../types/operations.types';

interface EscalationStatProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'warning' | 'success' | 'neutral';
}

const escalationToneStyles = {
  warning: 'text-amber-500 bg-amber-500/10',
  success: 'text-green-500 bg-green-500/10',
  neutral: 'text-muted-foreground bg-muted',
} as const;

function EscalationStat({ label, value, icon: Icon, tone }: EscalationStatProps) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', escalationToneStyles[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
        {new Intl.NumberFormat('en-US').format(value)}
      </p>
    </div>
  );
}

function SkeletonTiles() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-background/50 p-4">
          <div className="flex animate-pulse items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
          <div className="mt-3 h-6 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function hasEscalationData(metrics: EscalationMetrics): boolean {
  return metrics.active > 0 || metrics.completed > 0 || metrics.cancelled > 0;
}

export function EscalationOverviewPanel() {
  const { data, isLoading, error, refetch } = useOperationsEscalations();

  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Siren className="h-5 w-5 text-primary" aria-hidden="true" />
          Escalation Overview
        </h2>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <OperationsErrorState description={errorMessage} onRetry={() => void refetch()} />
        )}

        {!errorMessage && isLoading && <SkeletonTiles />}

        {!errorMessage && !isLoading && data && !hasEscalationData(data) && (
          <OperationsEmptyState
            title="No escalation activity"
            description="No incident escalations exist for this organization."
            icon={<Layers className="h-8 w-8" aria-hidden="true" />}
          />
        )}

        {!errorMessage && !isLoading && data && hasEscalationData(data) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <EscalationStat
                label="Active"
                value={data.active}
                icon={Siren}
                tone="warning"
              />
              <EscalationStat
                label="Completed"
                value={data.completed}
                icon={CheckCircle2}
                tone="success"
              />
              <EscalationStat
                label="Cancelled"
                value={data.cancelled}
                icon={Ban}
                tone="neutral"
              />
            </div>

            {Object.keys(data.by_level).length > 0 && (
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Active escalations by level
                </h3>
                <ul className="flex flex-wrap gap-2" role="list">
                  {Object.entries(data.by_level)
                    .sort(([levelA], [levelB]) => Number(levelA) - Number(levelB))
                    .map(([level, count]) => (
                      <li
                        key={level}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm"
                      >
                        <span className="text-muted-foreground">Level {level}</span>
                        <span className="font-semibold tabular-nums text-foreground">{count}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}