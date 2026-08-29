/**
 * IncidentMetricsGrid component.
 *
 * Renders a responsive grid of IncidentMetricCard entries with loading,
 * error, and success states derived from real backend dashboard data.
 */

import { Card } from '../../../components/ui/Card';
import { cn } from '../../../utils/cn';
import { OperationsErrorState } from './OperationsErrorState';
import type { IncidentMetricData } from './IncidentMetricCard';
import { IncidentMetricCard } from './IncidentMetricCard';

interface IncidentMetricsGridProps {
  metrics: IncidentMetricData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

function getErrorMessage(error: string | Error): string {
  return error instanceof Error ? error.message : String(error);
}

export function IncidentMetricsGrid({
  metrics,
  isLoading = false,
  error,
  onRetry,
  className,
}: IncidentMetricsGridProps) {
  if (error) {
    return (
      <div className={className}>
        <Card>
          <OperationsErrorState
            description={getErrorMessage(error)}
            onRetry={onRetry}
          />
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
      role="region"
      aria-label="Incident summary metrics"
    >
      {isLoading
        ? Array.from({ length: metrics.length || 4 }).map((_, index) => (
            <Card
              key={index}
              className="p-5"
              aria-hidden="true"
            >
              <div className="flex animate-pulse items-start gap-4">
                <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-7 w-12 rounded bg-muted" />
                </div>
              </div>
            </Card>
          ))
        : metrics.map((metric) => (
            <IncidentMetricCard key={metric.id} metric={metric} />
          ))}
    </div>
  );
}