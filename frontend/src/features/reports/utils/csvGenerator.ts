/**
 * CSV Generator for PulseDesk Reports.
 *
 * Generates an RFC 4180 compliant CSV export containing all operational
 * reporting metrics for the active organization and filter date range.
 */

import type {
  AverageResolutionTimeResponse,
  EscalationActivityResponse,
  IncidentsByCategoryResponse,
  IncidentsByPriorityResponse,
  IncidentsByStatusResponse,
  IncidentSummaryResponse,
  IncidentTrendResponse,
  ReportsDateRange,
  SLAPerformanceResponse,
  TrendGranularity,
} from '../types/report.types';

export interface ReportExportDataset {
  organizationName: string;
  organizationId: string;
  dateRange: ReportsDateRange;
  granularity: TrendGranularity;
  summary?: IncidentSummaryResponse | null;
  status?: IncidentsByStatusResponse | null;
  priority?: IncidentsByPriorityResponse | null;
  category?: IncidentsByCategoryResponse | null;
  trend?: IncidentTrendResponse | null;
  sla?: SLAPerformanceResponse | null;
  resolution?: AverageResolutionTimeResponse | null;
  escalation?: EscalationActivityResponse | null;
}

/**
 * Escapes a cell value for RFC 4180 CSV compliance.
 */
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const stringValue = String(value);
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return `"${stringValue}"`;
}

function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Builds the complete CSV string for the report dataset.
 */
export function generateReportCsv(dataset: ReportExportDataset): string {
  const lines: string[] = [];

  const addRow = (...cells: (string | number | null | undefined)[]) => {
    lines.push(cells.map(escapeCsvCell).join(','));
  };

  const addEmptyRow = () => {
    lines.push('');
  };

  // Header & Metadata
  addRow('PulseDesk Operational Report');
  addRow('Organization', dataset.organizationName);
  addRow('Organization ID', dataset.organizationId);
  addRow('Export Generated At', new Date().toISOString());
  addRow('Date Range Start', dataset.dateRange.start);
  addRow('Date Range End', dataset.dateRange.end);
  addRow('Trend Granularity', dataset.granularity);
  addEmptyRow();

  // 1. Incident Overview Summary
  addRow('=== INCIDENT OVERVIEW SUMMARY ===');
  addRow('Metric', 'Count');
  addRow('Total Incidents', dataset.summary?.total_incidents ?? 0);
  addRow('Open Incidents', dataset.summary?.open_incidents ?? 0);
  addRow('Resolved Incidents', dataset.summary?.resolved_incidents ?? 0);
  addRow('Closed Incidents', dataset.summary?.closed_incidents ?? 0);
  addRow('Unassigned Incidents', dataset.summary?.unassigned_incidents ?? 0);
  addRow('Critical Incidents', dataset.summary?.critical_incidents ?? 0);
  addEmptyRow();

  // 2. Incidents by Status
  addRow('=== INCIDENTS BY STATUS ===');
  addRow('Status', 'Count');
  addRow('OPEN', dataset.status?.OPEN ?? 0);
  addRow('ACKNOWLEDGED', dataset.status?.ACKNOWLEDGED ?? 0);
  addRow('IN_PROGRESS', dataset.status?.IN_PROGRESS ?? 0);
  addRow('RESOLVED', dataset.status?.RESOLVED ?? 0);
  addRow('CLOSED', dataset.status?.CLOSED ?? 0);
  addEmptyRow();

  // 3. Incidents by Priority
  addRow('=== INCIDENTS BY PRIORITY ===');
  addRow('Priority', 'Severity', 'Count');
  addRow('P1', 'Critical', dataset.priority?.P1 ?? 0);
  addRow('P2', 'High', dataset.priority?.P2 ?? 0);
  addRow('P3', 'Medium', dataset.priority?.P3 ?? 0);
  addRow('P4', 'Low', dataset.priority?.P4 ?? 0);
  addEmptyRow();

  // 4. Incidents by Category
  addRow('=== INCIDENTS BY CATEGORY ===');
  addRow('Category Name', 'Incident Count');
  if (dataset.category?.categories && dataset.category.categories.length > 0) {
    dataset.category.categories.forEach((cat) => {
      addRow(cat.category_name, cat.count);
    });
  } else {
    addRow('No categories available', 0);
  }
  addEmptyRow();

  // 5. Incident Trend
  addRow(`=== INCIDENT VOLUME TREND (${dataset.granularity.toUpperCase()}) ===`);
  addRow('Time Period', 'Incident Volume');
  if (dataset.trend?.data && dataset.trend.data.length > 0) {
    dataset.trend.data.forEach((point) => {
      addRow(point.date || point.week || 'Unknown', point.count);
    });
  } else {
    addRow('No trend data in selected date range', 0);
  }
  addEmptyRow();

  // 6. SLA Performance
  addRow('=== SLA PERFORMANCE METRICS ===');
  addRow('Metric', 'Value');
  addRow('Total SLA Incidents', dataset.sla?.total_sla_incidents ?? 0);
  addRow('Compliant Incidents', dataset.sla?.compliant_incidents ?? 0);
  addRow('Breached Incidents', dataset.sla?.breached_incidents ?? 0);
  addRow('Completed SLA Records', dataset.sla?.completed_sla_records ?? 0);
  addRow(
    'SLA Compliance Percentage',
    `${(dataset.sla?.compliance_percentage ?? 0).toFixed(1)}%`
  );
  addEmptyRow();

  // 7. Resolution Time
  addRow('=== AVERAGE RESOLUTION TIME ===');
  addRow('Metric', 'Value');
  addRow(
    'Average Resolution Time',
    formatDurationSeconds(dataset.resolution?.average_resolution_seconds ?? 0)
  );
  addRow(
    'Average Resolution Seconds',
    dataset.resolution?.average_resolution_seconds ?? 0
  );
  addRow(
    'Resolved Incidents Count',
    dataset.resolution?.resolved_incident_count ?? 0
  );
  addEmptyRow();

  // 8. Escalation Activity
  addRow('=== ESCALATION ACTIVITY ===');
  addRow('Total Escalation Events', dataset.escalation?.total_escalation_events ?? 0);
  addRow('Escalations by Level', 'Count');
  if (dataset.escalation?.by_level) {
    Object.entries(dataset.escalation.by_level).forEach(([level, count]) => {
      addRow(`Level ${level}`, count);
    });
  }
  addRow('Escalations by Trigger Type', 'Count');
  if (dataset.escalation?.by_trigger_type) {
    Object.entries(dataset.escalation.by_trigger_type).forEach(([trigger, count]) => {
      addRow(trigger, count);
    });
  }

  return lines.join('\r\n');
}

/**
 * Downloads a generated CSV report in the browser.
 */
export function downloadReportCsv(dataset: ReportExportDataset): void {
  const csvContent = generateReportCsv(dataset);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);

  const orgSlug = dataset.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const startDate = dataset.dateRange.start.slice(0, 10);
  const endDate = dataset.dateRange.end.slice(0, 10);
  const filename = `pulsedesk-report-${orgSlug}-${startDate}-to-${endDate}.csv`;

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}
