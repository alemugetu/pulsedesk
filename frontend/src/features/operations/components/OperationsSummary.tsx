/**
 * OperationsSummary component.
 *
 * Composes the summary metrics grid from the real backend dashboard APIs:
 * - GET .../dashboard/summary/
 * - GET .../dashboard/priority-distribution/
 *
 * Only backend-supported metrics are displayed. The priority distribution
 * provides the authoritative "critical" (P1) and "total" counts because the
 * summary endpoint does not expose them.
 */

import { useMemo } from 'react';
import { AlertTriangle, Clock, Flame, Layers, ShieldAlert, TriangleAlert, UserX } from 'lucide-react';
import { useOperationsSummary } from '../hooks/useOperationsSummary';
import { useOperationsPriorityDistribution } from '../hooks/useOperationsPriorityDistribution';
import { IncidentMetricsGrid } from './IncidentMetricsGrid';
import type { IncidentMetricData } from './IncidentMetricCard';

function getErrorMessage(error: Error | unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function OperationsSummary() {
  const summaryQuery = useOperationsSummary();
  const distributionQuery = useOperationsPriorityDistribution();

  const isLoading = summaryQuery.isLoading || distributionQuery.isLoading;
  const error = summaryQuery.error || distributionQuery.error;

  const handleRetry = () => {
    void summaryQuery.refetch();
    void distributionQuery.refetch();
  };

  const metrics = useMemo<IncidentMetricData[]>(() => {
    const summary = summaryQuery.data;
    const distribution = distributionQuery.data;

    return [
      {
        id: 'open-incidents',
        label: 'Open Incidents',
        value: summary?.open_incidents ?? 0,
        icon: AlertTriangle,
        href: '/app/incidents',
      },
      {
        id: 'critical-incidents',
        label: 'Critical Incidents',
        value: distribution?.critical ?? 0,
        icon: Flame,
        tone: 'critical',
        href: '/app/incidents?priority=P1',
      },
      {
        id: 'unassigned-incidents',
        label: 'Unassigned Incidents',
        value: summary?.unassigned_incidents ?? 0,
        icon: UserX,
        tone: 'warning',
      },
      {
        id: 'sla-at-risk',
        label: 'SLA At Risk',
        value: summary?.sla_at_risk ?? 0,
        icon: Clock,
        tone: 'warning',
      },
      {
        id: 'sla-breached',
        label: 'SLA Breached',
        value: summary?.sla_breached ?? 0,
        icon: ShieldAlert,
        tone: 'critical',
        href: '/app/incidents?sla_state=BREACHED',
      },
      {
        id: 'active-escalations',
        label: 'Active Escalations',
        value: summary?.active_escalations ?? 0,
        icon: TriangleAlert,
        tone: 'warning',
      },
      {
        id: 'total-incidents',
        label: 'Total Incidents',
        value: distribution
          ? distribution.low + distribution.medium + distribution.high + distribution.critical
          : 0,
        icon: Layers,
      },
    ];
  }, [summaryQuery.data, distributionQuery.data]);

  return (
    <section aria-labelledby="operations-summary-heading">
      <h2
        id="operations-summary-heading"
        className="mb-3 text-lg font-semibold text-foreground"
      >
        Summary
      </h2>
      <IncidentMetricsGrid
        metrics={metrics}
        isLoading={isLoading}
        error={error ? getErrorMessage(error) : null}
        onRetry={handleRetry}
      />
    </section>
  );
}