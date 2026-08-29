/**
 * Operations feature barrel exports (Phase 13.9 - Operations Command Center).
 */

export { OperationsCommandCenterPage } from './pages/OperationsCommandCenterPage';

export type {
  OperationsSummary as OperationsSummaryData,
  PriorityDistribution,
  SlaMetrics,
  EscalationMetrics,
  DashboardIncident,
  DashboardIncidentListResponse,
  OperationsIncidentFilters,
  IncidentStatusDistribution,
  DashboardSlaState,
  DashboardEscalationState,
} from './types/operations.types';

export {
  getOperationsSummary,
  getPriorityDistribution,
  getSlaMetrics,
  getEscalationMetrics,
  getDashboardIncidents,
  getOperationsActiveIncidents,
  getIncidentStatusDistribution,
  ACTIVE_INCIDENT_STATUSES,
} from './services/operationsService';

export { useOperationsSummary } from './hooks/useOperationsSummary';
export { useOperationsIncidents } from './hooks/useOperationsIncidents';
export { useOperationsSla } from './hooks/useOperationsSla';
export { useOperationsEscalations } from './hooks/useOperationsEscalations';
export { useOperationsPriorityDistribution } from './hooks/useOperationsPriorityDistribution';
export { useOperationsStatusDistribution } from './hooks/useOperationsStatusDistribution';
export { useOperationsActiveIncidents } from './hooks/useOperationsActiveIncidents';

export { OperationsHeader } from './components/OperationsHeader';
export { OperationsSummary } from './components/OperationsSummary';
export { IncidentMetricsGrid } from './components/IncidentMetricsGrid';
export { IncidentMetricCard } from './components/IncidentMetricCard';
export { ActiveIncidentsPanel } from './components/ActiveIncidentsPanel';
export { CriticalIncidentsPanel } from './components/CriticalIncidentsPanel';
export { RecentIncidentsPanel } from './components/RecentIncidentsPanel';
export { DashboardIncidentList } from './components/DashboardIncidentList';
export { SlaOverviewPanel } from './components/SlaOverviewPanel';
export { EscalationOverviewPanel } from './components/EscalationOverviewPanel';
export { IncidentStatusChart } from './components/IncidentStatusChart';
export { IncidentPriorityChart } from './components/IncidentPriorityChart';
export { OperationsEmptyState } from './components/OperationsEmptyState';
export { OperationsErrorState } from './components/OperationsErrorState';