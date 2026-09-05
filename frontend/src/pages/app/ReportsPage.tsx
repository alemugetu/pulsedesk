/**
 * Reports Page for PulseDesk.
 *
 * Displays operational analytics and reports for the current organization.
 * All data is fetched from the backend Reports API and scoped to the active
 * organization. Frontend permission checks are UX-only — backend is the
 * authoritative security boundary.
 */

import { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { ReportFilters } from '../../features/reports/components/ReportFilters';
import { ReportsEmptyState } from '../../features/reports/components/ReportsEmptyState';
import { IncidentOverviewCard } from '../../features/reports/components/IncidentOverviewCard';
import { IncidentStatusChart } from '../../features/reports/components/IncidentStatusChart';
import { IncidentPriorityChart } from '../../features/reports/components/IncidentPriorityChart';
import { IncidentTrendChart } from '../../features/reports/components/IncidentTrendChart';
import { SLAMetricsCard } from '../../features/reports/components/SLAMetricsCard';
import { EscalationMetricsCard } from '../../features/reports/components/EscalationMetricsCard';
import { useCanViewReports } from '../../features/reports/hooks/useReports';
import { useOptionalOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { ReportExportControls } from '../../features/reports/components/ReportExportControls';
import type { ReportExportDataset } from '../../features/reports/utils/csvGenerator';
import {
  useIncidentSummary,
  useIncidentsByStatus,
  useIncidentsByPriority,
  useIncidentsByCategory,
  useIncidentTrend,
} from '../../features/reports/hooks/useIncidentReports';
import { useSLAPerformance } from '../../features/reports/hooks/useSLAReports';
import { useEscalationActivity } from '../../features/reports/hooks/useEscalationReports';
import { useAverageResolutionTime } from '../../features/reports/hooks/useSLAReports';
import { getDefaultDateRange } from '../../features/reports/utils/reportUtils';
import type { ReportsDateRange, TrendGranularity } from '../../features/reports/types/report.types';

export function ReportsPage() {
  const canViewReports = useCanViewReports();
  const orgContext = useOptionalOrganizationContext();
  const currentOrganization = orgContext?.currentOrganization;
  const [dateRange, setDateRange] = useState<ReportsDateRange>(getDefaultDateRange);
  const [granularity, setGranularity] = useState<TrendGranularity>('daily');

  const summaryQuery = useIncidentSummary(dateRange);
  const statusQuery = useIncidentsByStatus(dateRange);
  const priorityQuery = useIncidentsByPriority(dateRange);
  const categoryQuery = useIncidentsByCategory(dateRange);
  const trendQuery = useIncidentTrend(dateRange, granularity);
  const slaQuery = useSLAPerformance(dateRange);
  const resolutionQuery = useAverageResolutionTime(dateRange);
  const escalationQuery = useEscalationActivity(dateRange);

  const allLoading = useMemo(() => {
    return (
      summaryQuery.isLoading &&
      statusQuery.isLoading &&
      priorityQuery.isLoading &&
      categoryQuery.isLoading &&
      trendQuery.isLoading &&
      slaQuery.isLoading &&
      resolutionQuery.isLoading &&
      escalationQuery.isLoading
    );
  }, [
    summaryQuery.isLoading,
    statusQuery.isLoading,
    priorityQuery.isLoading,
    categoryQuery.isLoading,
    trendQuery.isLoading,
    slaQuery.isLoading,
    resolutionQuery.isLoading,
    escalationQuery.isLoading,
  ]);

  const hasAnyError = useMemo(() => {
    return (
      summaryQuery.error ??
      statusQuery.error ??
      priorityQuery.error ??
      categoryQuery.error ??
      trendQuery.error ??
      slaQuery.error ??
      resolutionQuery.error ??
      escalationQuery.error ??
      null
    );
  }, [
    summaryQuery.error,
    statusQuery.error,
    priorityQuery.error,
    categoryQuery.error,
    trendQuery.error,
    slaQuery.error,
    resolutionQuery.error,
    escalationQuery.error,
  ]);

  const hasAnyData = useMemo(() => {
    return !!(
      summaryQuery.data ||
      statusQuery.data ||
      priorityQuery.data ||
      categoryQuery.data ||
      trendQuery.data ||
      slaQuery.data ||
      resolutionQuery.data ||
      escalationQuery.data
    );
  }, [
    summaryQuery.data,
    statusQuery.data,
    priorityQuery.data,
    categoryQuery.data,
    trendQuery.data,
    slaQuery.data,
    resolutionQuery.data,
    escalationQuery.data,
  ]);

  const exportDataset: ReportExportDataset = useMemo(() => ({
    organizationName: currentOrganization?.name || 'PulseDesk Organization',
    organizationId: currentOrganization?.id || 'unknown',
    dateRange,
    granularity,
    summary: summaryQuery.data,
    status: statusQuery.data,
    priority: priorityQuery.data,
    category: categoryQuery.data,
    trend: trendQuery.data,
    sla: slaQuery.data,
    resolution: resolutionQuery.data,
    escalation: escalationQuery.data,
  }), [
    currentOrganization?.name,
    currentOrganization?.id,
    dateRange,
    granularity,
    summaryQuery.data,
    statusQuery.data,
    priorityQuery.data,
    categoryQuery.data,
    trendQuery.data,
    slaQuery.data,
    resolutionQuery.data,
    escalationQuery.data,
  ]);

  const refetchAll = () => {
    summaryQuery.refetch();
    statusQuery.refetch();
    priorityQuery.refetch();
    categoryQuery.refetch();
    trendQuery.refetch();
    slaQuery.refetch();
    resolutionQuery.refetch();
    escalationQuery.refetch();
  };

  if (!canViewReports) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <CardContent className="p-0">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Access Restricted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You do not have permission to view reports. Contact your organization administrator
              for access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 bg-background">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational analytics and insights for your organization.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <ReportFilters
            dateRange={dateRange}
            granularity={granularity}
            onDateRangeChange={setDateRange}
            onGranularityChange={setGranularity}
          />
          <ReportExportControls
            dataset={exportDataset}
            isDisabled={allLoading || !hasAnyData}
            canExport={canViewReports}
          />
        </div>
      </div>

      {hasAnyError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-500" role="alert">
            {hasAnyError.message}
          </p>
          <button
            onClick={refetchAll}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry All
          </button>
        </div>
      )}

      {allLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!allLoading && !hasAnyData && (
        <ReportsEmptyState />
      )}

      {!allLoading && hasAnyData && (
        <div className="space-y-6">
          <section aria-labelledby="incident-overview-heading">
            <h2 id="incident-overview-heading" className="sr-only">
              Incident Overview
            </h2>
            {summaryQuery.data && <IncidentOverviewCard data={summaryQuery.data} />}
            {summaryQuery.isLoading && !summaryQuery.data && (
              <div className="h-48 animate-pulse rounded-lg bg-muted" />
            )}
          </section>

          <section aria-labelledby="incident-breakdown-heading" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <h2 id="incident-breakdown-heading" className="sr-only">
              Incident Breakdown
            </h2>
            <IncidentStatusChart
              data={statusQuery.data}
              isLoading={statusQuery.isLoading && !statusQuery.data}
              error={statusQuery.error}
              onRetry={statusQuery.refetch}
            />
            <IncidentPriorityChart
              data={priorityQuery.data}
              isLoading={priorityQuery.isLoading && !priorityQuery.data}
              error={priorityQuery.error}
              onRetry={priorityQuery.refetch}
            />
          </section>

          <section aria-labelledby="incident-trend-heading">
            <h2 id="incident-trend-heading" className="sr-only">
              Incident Trend
            </h2>
            <IncidentTrendChart
              data={trendQuery.data}
              isLoading={trendQuery.isLoading && !trendQuery.data}
              error={trendQuery.error}
              onRetry={trendQuery.refetch}
            />
          </section>

          <section aria-labelledby="sla-heading" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <h2 id="sla-heading" className="sr-only">
              SLA Performance
            </h2>
            <SLAMetricsCard
              data={slaQuery.data}
              isLoading={slaQuery.isLoading && !slaQuery.data}
              error={slaQuery.error}
              onRetry={slaQuery.refetch}
            />
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-foreground">Resolution Time</h3>
              </CardHeader>
              <CardContent>
                {resolutionQuery.error && (
                  <p className="text-sm text-red-500" role="alert">
                    {resolutionQuery.error.message}
                  </p>
                )}
                {resolutionQuery.isLoading && !resolutionQuery.data && (
                  <div className="animate-pulse rounded bg-muted p-8 text-center text-sm text-muted-foreground">
                    Loading resolution time...
                  </div>
                )}
                {resolutionQuery.data && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <MetricBlock
                      label="Average Resolution Time"
                      value={formatDuration(resolutionQuery.data.average_resolution_seconds)}
                    />
                    <MetricBlock
                      label="Resolved Incidents"
                      value={resolutionQuery.data.resolved_incident_count.toString()}
                    />
                  </div>
                )}
                {!resolutionQuery.isLoading && !resolutionQuery.data && !resolutionQuery.error && (
                  <p className="text-sm text-muted-foreground">
                    No resolution time data available for the selected date range.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="escalation-heading">
            <h2 id="escalation-heading" className="sr-only">
              Escalation Activity
            </h2>
            <EscalationMetricsCard
              data={escalationQuery.data}
              isLoading={escalationQuery.isLoading && !escalationQuery.data}
              error={escalationQuery.error}
              onRetry={escalationQuery.refetch}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds === 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

