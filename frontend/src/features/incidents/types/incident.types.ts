/**
 * Incident types for PulseDesk.
 * 
 * TypeScript models matching the backend Incident API contract.
 * Based on backend models and serializers in backend/apps/incidents/
 */

import type { SLAState, IncidentSLASummary } from '../../sla/types/sla.types';

/**
 * Incident status enum matching backend IncidentStatus
 */
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

/**
 * Incident priority enum matching backend IncidentPriority
 */
export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';

/**
 * Re-export SLA types for convenience
 */
export type { SLAState, IncidentSLASummary };

/**
 * Incident category model
 */
export interface IncidentCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Minimal incident category (for embedded in incident)
 */
export interface IncidentCategoryMinimal {
  id: string;
  name: string;
}

/**
 * User reference (reporter/assignee user)
 */
export interface UserReference {
  id: string;
  email: string;
}

/**
 * Assignee membership reference
 */
export interface AssigneeReference {
  id: string;
  user: UserReference;
}

/**
 * Full incident model
 */
export interface Incident {
  id: string;
  incident_number: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  category: IncidentCategoryMinimal | null;
  reporter: UserReference | null;
  assignee: AssigneeReference | null;
  sla: IncidentSLASummary | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Paginated incident list response
 */
export interface IncidentListResponse {
  results: Incident[];
  meta: PaginationMeta;
}

/**
 * Incident create request
 */
export interface CreateIncidentRequest {
  title: string;
  description?: string;
  priority?: IncidentPriority;
  category_id?: string | null;
  assignee_id?: string | null;
}

/**
 * Incident update request
 */
export interface UpdateIncidentRequest {
  title?: string;
  description?: string;
  priority?: IncidentPriority;
  category_id?: string | null;
  assignee_id?: string | null;
  status?: IncidentStatus;
}

/**
 * Incident filter state
 */
export interface IncidentFilters {
  search?: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
  assignee?: string;
  category?: string;
  created_after?: string;
  created_before?: string;
  sla_state?: SLAState;
  ordering?: string;
  page?: number;
}

/**
 * Incident category create request
 */
export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
}

/**
 * Incident category update request
 */
export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * API error structure
 */
export interface IncidentAPIError {
  message: string;
  field?: string;
  code?: string;
}

/**
 * Incident validation error
 */
export interface IncidentValidationError {
  title?: string[];
  description?: string[];
  priority?: string[];
  category_id?: string[];
  assignee_id?: string[];
  status?: string[];
  non_field_errors?: string[];
}
