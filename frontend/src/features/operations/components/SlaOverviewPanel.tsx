/**
 * SlaOverviewPanel component.
 *
 * Displays backend-computed SLA metrics (GET .../dashboard/sla-metrics/).
 * Only real counts are shown — no SLA percentages or elapsed-time estimates
 * are fabricated (per the Phase 13.8 decision).
 */

import { ShieldCheck, ShieldAlert, Timer, CheckCircle2, ArrowRightCircle, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { cn } from '../../../utils/cn';
import { useOperationsSla } from '../hooks/useOperationsSla';
import { OperationsEmptyState } from './OperationsEmptyState';
import { OperationsErrorState } from './OperationsErrorState';
import type { SlaMetrics } from '../types/operations.types';

interface StatTileProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'success' | 'warning' | 'critical' | 'neutral';
}

const statToneStyles = {
  success: 'text-green-500 bg-green-500/10',
  warning: 'text-amber-500 bg-amber-500/10',
  critical: 'text-red-500 bg-red-500/10',
  neutral: 'text-primary bg-primary/10',
} as const;

function StatTile({ label, value, icon: Icon, tone }: StatTileProps) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', statToneStyles[tone])}>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-background/50 p-4">
          <div className="flex animate-pulse items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="mt-3 h-6 w-12 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function hasSlaData(metrics: SlaMetrics): boolean {
  return (
    metrics.healthy > 0 ||
    metrics.approaching > 0 ||
    metrics.breached > 0 ||
    metrics.resolved_within_sla > 0
  );
}

export function SlaOverviewPanel() {
  const { data, isLoading, error, refetch } = useOperationsSla();

  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          SLA Overview
        </h2>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <OperationsErrorState description={errorMessage} onRetry={() => void refetch()} />
        )}

        {!errorMessage && isLoading && <SkeletonTiles />}

        {!errorMessage && !isLoading && data && !hasSlaData(data) && (
          <OperationsEmptyState
            title="No SLA data"
            description="No incidents with SLA tracking exist for this organization."
            icon={<Timer className="h-8 w-8" aria-hidden="true" />}
          />
        )}

        {!errorMessage && !isLoading && data && hasSlaData(data) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatTile
                label="Healthy"
                value={data.healthy}
                icon={ShieldCheck}
                tone="success"
              />
              <StatTile
                label="Approaching"
                value={data.approaching}
                icon={Timer}
                tone="warning"
              />
              <StatTile
                label="Breached"
                value={data.breached}
                icon={ShieldAlert}
                tone="critical"
              />
              <StatTile
                label="Resolved within SLA"
                value={data.resolved_within_sla}
                icon={CheckCircle2}
                tone="success"
              />
            </div>

            <div className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Breach breakdown
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <ArrowRightCircle className="h-4 w-4" aria-hidden="true" />
                    Response breaches
                  </dt>
                  <dd className="font-semibold tabular-nums text-foreground">{data.response_breaches}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <FileWarning className="h-4 w-4" aria-hidden="true" />
                    Resolution breaches
                  </dt>
                  <dd className="font-semibold tabular-nums text-foreground">{data.resolution_breaches}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}