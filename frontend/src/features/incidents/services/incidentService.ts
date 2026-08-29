/**
 * Incident service for PulseDesk.
 * 
 * Handles all incident-related API calls using the existing API client.
 * Based on backend API contract in backend/apps/incidents/
 * 
 * Endpoints:
 * - GET /api/v1/organizations/<organization_id>/incidents/ - List incidents
 * - POST /api/v1/organizations/<organization_id>/incidents/ - Create incident
 * - GET /api/v1/organizations/<organization_id>/incidents/<incident_id>/ - Get incident detail
 * - PATCH /api/v1/organizations/<organization_id>/incidents/<incident_id>/ - Update incident
 * - GET /api/v1/organizations/<organization_id>/incident-categories/ - List categories
 * - POST /api/v1/organizations/<organization_id>/incident-categories/ - Create category
 * - GET /api/v1/organizations/<organization_id>/incident-categories/<category_id>/ - Get category detail
 * - PATCH /api/v1/organizations/<organization_id>/incident-categories/<category_id>/ - Update category
 */

import { api } from '../../../api/client';
import type {
  IncidentListResponse,
  Incident,
  CreateIncidentRequest,
  UpdateIncidentRequest,
  IncidentCategory,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../types/incident.types';

/**
 * Build organization-scoped URL for incidents
 */
function getIncidentsBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/incidents`;
}

/**
 * Build organization-scoped URL for incident categories
 */
function getCategoriesBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/incident-categories`;
}

/**
 * Get incidents for an organization with filtering and pagination
 * GET /api/v1/organizations/<organization_id>/incidents/
 * 
 * Query parameters:
 * - search: text search across title, description, incident_number
 * - status: filter by status (OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED)
 * - priority: filter by priority (P1, P2, P3, P4)
 * - assignee: filter by assignee membership UUID
 * - category: filter by category UUID
 * - created_after: ISO-8601 datetime filter
 * - created_before: ISO-8601 datetime filter
 * - sla_state: filter by SLA state (BREACHED, ON_TRACK, COMPLETED)
 * - ordering: comma-separated ordering fields (e.g., -created_at, priority)
 * - page: page number for pagination
 */
export async function getIncidents(
  organizationId: string,
  params?: {
    search?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    category?: string;
    created_after?: string;
    created_before?: string;
    sla_state?: string;
    ordering?: string;
    page?: number;
  }
): Promise<IncidentListResponse> {
  const url = `${getIncidentsBaseUrl(organizationId)}/`;
  return api.get<IncidentListResponse>(url, { params });
}

/**
 * Get a single incident by ID
 * GET /api/v1/organizations/<organization_id>/incidents/<incident_id>/
 */
export async function getIncident(
  organizationId: string,
  incidentId: string
): Promise<Incident> {
  const url = `${getIncidentsBaseUrl(organizationId)}/${incidentId}/`;
  const result = await api.get<Incident>(url);
  return result;
}

/**
 * Create a new incident
 * POST /api/v1/organizations/<organization_id>/incidents/
 * 
 * The authenticated user automatically becomes the reporter
 */
export async function createIncident(
  organizationId: string,
  data: CreateIncidentRequest
): Promise<Incident> {
  const url = `${getIncidentsBaseUrl(organizationId)}/`;
  const result = await api.post<Incident>(url, data);
  return result;
}

/**
 * Update an incident (fields, assignment, or status transition)
 * PATCH /api/v1/organizations/<organization_id>/incidents/<incident_id>/
 * 
 * This handles:
 * - Field updates (title, description, category, priority)
 * - Assignment changes (assignee_id)
 * - Status transitions (status)
 */
export async function updateIncident(
  organizationId: string,
  incidentId: string,
  data: UpdateIncidentRequest
): Promise<Incident> {
  const url = `${getIncidentsBaseUrl(organizationId)}/${incidentId}/`;
  return api.patch<Incident>(url, data);
}

/**
 * Get incident categories for an organization
 * GET /api/v1/organizations/<organization_id>/incident-categories/
 * 
 * Query parameters:
 * - is_active: filter by active status (true/false)
 */
export async function getIncidentCategories(
  organizationId: string,
  params?: {
    is_active?: boolean;
  }
): Promise<IncidentCategory[]> {
  const url = `${getCategoriesBaseUrl(organizationId)}/`;
  return api.get<IncidentCategory[]>(url, { params });
}

/**
 * Get a single incident category by ID
 * GET /api/v1/organizations/<organization_id>/incident-categories/<category_id>/
 */
export async function getIncidentCategory(
  organizationId: string,
  categoryId: string
): Promise<IncidentCategory> {
  const url = `${getCategoriesBaseUrl(organizationId)}/${categoryId}/`;
  return api.get<IncidentCategory>(url);
}

/**
 * Create a new incident category
 * POST /api/v1/organizations/<organization_id>/incident-categories/
 */
export async function createIncidentCategory(
  organizationId: string,
  data: CreateCategoryRequest
): Promise<IncidentCategory> {
  const url = `${getCategoriesBaseUrl(organizationId)}/`;
  return api.post<IncidentCategory>(url, data);
}

/**
 * Update an incident category
 * PATCH /api/v1/organizations/<organization_id>/incident-categories/<category_id>/
 */
export async function updateIncidentCategory(
  organizationId: string,
  categoryId: string,
  data: UpdateCategoryRequest
): Promise<IncidentCategory> {
  const url = `${getCategoriesBaseUrl(organizationId)}/${categoryId}/`;
  return api.patch<IncidentCategory>(url, data);
}
