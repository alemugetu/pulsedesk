/**
 * SLA service for PulseDesk.
 * 
 * Handles all SLA-related API calls using the existing API client.
 * Based on backend API contract in backend/apps/sla/
 * 
 * Endpoints:
 * - GET /api/v1/organizations/<organization_id>/sla-policies/ - List SLA policies
 * - POST /api/v1/organizations/<organization_id>/sla-policies/ - Create SLA policy
 * - GET /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/ - Get SLA policy detail
 * - PATCH /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/ - Update SLA policy
 * - GET /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/ - List SLA targets
 * - POST /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/ - Create SLA target
 * - GET /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/<target_id>/ - Get SLA target detail
 * - PATCH /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/<target_id>/ - Update SLA target
 */

import { api } from '../../../api/client';
import type {
  SLAPolicy,
  SLAPolicyCreateRequest,
  SLAPolicyUpdateRequest,
  SLATarget,
  SLATargetCreateRequest,
  SLATargetUpdateRequest,
} from '../types/sla.types';

/**
 * Build organization-scoped URL for SLA policies
 */
function getSlaPoliciesBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/sla-policies`;
}

/**
 * Build URL for SLA targets under a policy
 */
function getSlaTargetsBaseUrl(organizationId: string, policyId: string): string {
  return `${getSlaPoliciesBaseUrl(organizationId)}/${policyId}/targets`;
}

/**
 * Get SLA policies for an organization
 * GET /api/v1/organizations/<organization_id>/sla-policies/
 * 
 * Query parameters:
 * - is_active: filter by active status (true/false)
 */
export async function getSlaPolicies(
  organizationId: string,
  params?: {
    is_active?: boolean;
  }
): Promise<SLAPolicy[]> {
  const url = `${getSlaPoliciesBaseUrl(organizationId)}/`;
  return api.get<SLAPolicy[]>(url, { params });
}

/**
 * Get a single SLA policy by ID
 * GET /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/
 */
export async function getSlaPolicy(
  organizationId: string,
  policyId: string
): Promise<SLAPolicy> {
  const url = `${getSlaPoliciesBaseUrl(organizationId)}/${policyId}/`;
  return api.get<SLAPolicy>(url);
}

/**
 * Create a new SLA policy
 * POST /api/v1/organizations/<organization_id>/sla-policies/
 * 
 * Requires sla.manage permission
 */
export async function createSlaPolicy(
  organizationId: string,
  data: SLAPolicyCreateRequest
): Promise<SLAPolicy> {
  const url = `${getSlaPoliciesBaseUrl(organizationId)}/`;
  return api.post<SLAPolicy>(url, data);
}

/**
 * Update an SLA policy
 * PATCH /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/
 * 
 * Requires sla.manage permission
 */
export async function updateSlaPolicy(
  organizationId: string,
  policyId: string,
  data: SLAPolicyUpdateRequest
): Promise<SLAPolicy> {
  const url = `${getSlaPoliciesBaseUrl(organizationId)}/${policyId}/`;
  return api.patch<SLAPolicy>(url, data);
}

/**
 * Get SLA targets for a policy
 * GET /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/
 */
export async function getSlaTargets(
  organizationId: string,
  policyId: string
): Promise<SLATarget[]> {
  const url = `${getSlaTargetsBaseUrl(organizationId, policyId)}/`;
  return api.get<SLATarget[]>(url);
}

/**
 * Get a single SLA target by ID
 * GET /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/<target_id>/
 */
export async function getSlaTarget(
  organizationId: string,
  policyId: string,
  targetId: string
): Promise<SLATarget> {
  const url = `${getSlaTargetsBaseUrl(organizationId, policyId)}/${targetId}/`;
  return api.get<SLATarget>(url);
}

/**
 * Create a new SLA target
 * POST /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/
 * 
 * Requires sla.manage permission
 */
export async function createSlaTarget(
  organizationId: string,
  policyId: string,
  data: SLATargetCreateRequest
): Promise<SLATarget> {
  const url = `${getSlaTargetsBaseUrl(organizationId, policyId)}/`;
  return api.post<SLATarget>(url, data);
}

/**
 * Update an SLA target
 * PATCH /api/v1/organizations/<organization_id>/sla-policies/<policy_id>/targets/<target_id>/
 * 
 * Requires sla.manage permission
 */
export async function updateSlaTarget(
  organizationId: string,
  policyId: string,
  targetId: string,
  data: SLATargetUpdateRequest
): Promise<SLATarget> {
  const url = `${getSlaTargetsBaseUrl(organizationId, policyId)}/${targetId}/`;
  return api.patch<SLATarget>(url, data);
}
