export interface IncidentSummaryResponse {
  total_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  closed_incidents: number;
  unassigned_incidents: number;
  critical_incidents: number;
}

export interface IncidentsByStatusResponse {
  OPEN: number;
  ACKNOWLEDGED: number;
  IN_PROGRESS: number;
  RESOLVED: number;
  CLOSED: number;
}

export interface IncidentsByPriorityResponse {
  P1: number;
  P2: number;
  P3: number;
  P4: number;
}

export interface CategoryCount {
  category_id: string | null;
  category_name: string;
  count: number;
}

export interface IncidentsByCategoryResponse {
  categories: CategoryCount[];
}

export interface IncidentTrendResponse {
  granularity: 'daily' | 'weekly';
  data: Array<{ date?: string; week?: string; count: number }>;
}

export interface SLAPerformanceResponse {
  total_sla_incidents: number;
  compliant_incidents: number;
  breached_incidents: number;
  completed_sla_records: number;
  compliance_percentage: number;
}

export interface AverageResolutionTimeResponse {
  average_resolution_seconds: number;
  resolved_incident_count: number;
}

export interface EscalationActivityResponse {
  total_escalation_events: number;
  by_level: Record<string, number>;
  by_trigger_type: Record<string, number>;
}

export type ReportsDateRange = {
  start: string;
  end: string;
};

export type TrendGranularity = 'daily' | 'weekly';

