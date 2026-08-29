/**
 * SLA types for PulseDesk.
 * 
 * TypeScript models matching the backend SLA API contract.
 * Based on backend models and serializers in backend/apps/sla/
 */

/**
 * SLA status enum matching backend SLAStatus
 */
export type SLAStatus = 'ON_TRACK' | 'BREACHED' | 'COMPLETED';

/**
 * SLA state enum (same as SLAStatus for consistency)
 */
export type SLAState = SLAStatus;

/**
 * Incident priority enum (imported from incidents)
 */
export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';

/**
 * SLA Target model - priority-specific response and resolution time targets
 */
export interface SLATarget {
  id: string;
  priority: IncidentPriority;
  response_time_minutes: number;
  resolution_time_minutes: number;
  created_at: string;
  updated_at: string;
}

/**
 * SLA Policy model - organization-scoped named SLA policy
 */
export interface SLAPolicy {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  targets: SLATarget[];
  created_at: string;
  updated_at: string;
}

/**
 * Incident SLA summary (embedded in incident response)
 * Based on IncidentSLASummarySerializer from backend
 */
export interface IncidentSLASummary {
  policy: string;
  response_deadline: string;
  resolution_deadline: string;
  response_status: SLAStatus;
  resolution_status: SLAStatus;
  response_completed_at: string | null;
  resolution_completed_at: string | null;
}

/**
 * SLA Policy create request
 */
export interface SLAPolicyCreateRequest {
  name: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * SLA Policy update request
 */
export interface SLAPolicyUpdateRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * SLA Target create request
 */
export interface SLATargetCreateRequest {
  priority: IncidentPriority;
  response_time_minutes: number;
  resolution_time_minutes: number;
}

/**
 * SLA Target update request
 */
export interface SLATargetUpdateRequest {
  response_time_minutes?: number;
  resolution_time_minutes?: number;
}

/**
 * SLA Policy list response
 */
export interface SLAPolicyListResponse {
  results: SLAPolicy[];
}

/**
 * SLA Target list response
 */
export interface SLATargetListResponse {
  results: SLATarget[];
}
