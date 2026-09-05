export type {
  CategoryCount,
  EscalationActivityResponse,
  IncidentSummaryResponse,
  IncidentTrendResponse,
  IncidentsByCategoryResponse,
  IncidentsByPriorityResponse,
  IncidentsByStatusResponse,
  ReportsDateRange,
  SLAPerformanceResponse,
  AverageResolutionTimeResponse,
  TrendGranularity,
} from './types/report.types';

export {
  getAverageResolutionTime,
  getEscalationActivity,
  getIncidentSummary,
  getIncidentsByCategory,
  getIncidentsByPriority,
  getIncidentsByStatus,
  getIncidentTrend,
  getSLAPerformance,
} from './services/reportService';

export { useCanViewReports } from './hooks/useReports';
export {
  getEscalationReportsQueryKey,
  useEscalationActivity,
} from './hooks/useEscalationReports';
export {
  getIncidentReportsQueryKey,
  useIncidentsByCategory,
  useIncidentsByPriority,
  useIncidentsByStatus,
  useIncidentSummary,
  useIncidentTrend,
} from './hooks/useIncidentReports';
export {
  getSLAReportsQueryKey,
  useAverageResolutionTime,
  useSLAPerformance,
} from './hooks/useSLAReports';

export { ReportDateRange } from './components/ReportDateRange';
export { ReportFilters } from './components/ReportFilters';
export { ReportsEmptyState } from './components/ReportsEmptyState';
export { IncidentOverviewCard } from './components/IncidentOverviewCard';
export { IncidentStatusChart } from './components/IncidentStatusChart';
export { IncidentPriorityChart } from './components/IncidentPriorityChart';
export { IncidentTrendChart } from './components/IncidentTrendChart';
export { SLAMetricsCard } from './components/SLAMetricsCard';
export { EscalationMetricsCard } from './components/EscalationMetricsCard';
export { ReportExportControls } from './components/ReportExportControls';
export {
  generateReportCsv,
  downloadReportCsv,
  type ReportExportDataset,
} from './utils/csvGenerator';
export {
  generateReportPdfBlob,
  downloadReportPdf,
} from './utils/pdfGenerator';
