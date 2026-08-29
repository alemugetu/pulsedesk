/**
 * Escalation service for PulseDesk.
 * 
 * Handles all escalation-related API calls using the existing API client.
 * Based on backend API contract in backend/apps/escalation/
 * 
 * Endpoints:
 * - GET /api/v1/organizations/<organization_id>/escalation-policies/ - List escalation policies
 * - POST /api/v1/organizations/<organization_id>/escalation-policies/ - Create escalation policy
 * - GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/ - Get escalation policy detail
 * - PATCH /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/ - Update escalation policy
 * - GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/ - List escalation levels
 * - POST /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/ - Create escalation level
 * - GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/<level_id>/ - Get escalation level detail
 * - PATCH /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/<level_id>/ - Update escalation level
 * - GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/rules/ - List escalation rules
 * - POST /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/rules/ - Create escalation rule
 * - GET /api/v1/organizations/<organization_id>/incidents/<incident_id>/escalations/ - List incident escalation history
 * - POST /api/v1/organizations/<organization_id>/incidents/<incident_id>/escalations/evaluate/ - Evaluate incident escalation
 */

import { api } from '../../../api/client';
import type {
  EscalationPolicy,
  EscalationPolicyCreateRequest,
  EscalationPolicyUpdateRequest,
  EscalationLevel,
  EscalationLevelCreateRequest,
  EscalationLevelUpdateRequest,
  EscalationRule,
  EscalationRuleCreateRequest,
  IncidentEscalation,
  EscalationEvaluateRequest,
} from '../types/escalation.types';

/**
 * Build organization-scoped URL for escalation policies
 */
function getEscalationPoliciesBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/escalation-policies`;
}

/**
 * Build URL for escalation levels under a policy
 */
function getEscalationLevelsBaseUrl(organizationId: string, policyId: string): string {
  return `${getEscalationPoliciesBaseUrl(organizationId)}/${policyId}/levels`;
}

/**
 * Build URL for escalation rules under a policy
 */
function getEscalationRulesBaseUrl(organizationId: string, policyId: string): string {
  return `${getEscalationPoliciesBaseUrl(organizationId)}/${policyId}/rules`;
}

/**
 * Build URL for incident escalations
 */
function getIncidentEscalationsBaseUrl(organizationId: string, incidentId: string): string {
  return `/api/v1/organizations/${organizationId}/incidents/${incidentId}/escalations`;
}

/**
 * Get escalation policies for an organization
 * GET /api/v1/organizations/<organization_id>/escalation-policies/
 * 
 * Query parameters:
 * - is_active: filter by active status (true/false)
 */
export async function getEscalationPolicies(
  organizationId: string,
  params?: {
    is_active?: boolean;
  }
): Promise<EscalationPolicy[]> {
  const url = `${getEscalationPoliciesBaseUrl(organizationId)}/`;
  return api.get<EscalationPolicy[]>(url, { params });
}

/**
 * Get a single escalation policy by ID
 * GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/
 */
export async function getEscalationPolicy(
  organizationId: string,
  policyId: string
): Promise<EscalationPolicy> {
  const url = `${getEscalationPoliciesBaseUrl(organizationId)}/${policyId}/`;
  return api.get<EscalationPolicy>(url);
}

/**
 * Create a new escalation policy
 * POST /api/v1/organizations/<organization_id>/escalation-policies/
 * 
 * Requires escalation.manage permission
 */
export async function createEscalationPolicy(
  organizationId: string,
  data: EscalationPolicyCreateRequest
): Promise<EscalationPolicy> {
  const url = `${getEscalationPoliciesBaseUrl(organizationId)}/`;
  return api.post<EscalationPolicy>(url, data);
}

/**
 * Update an escalation policy
 * PATCH /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/
 * 
 * Requires escalation.manage permission
 */
export async function updateEscalationPolicy(
  organizationId: string,
  policyId: string,
  data: EscalationPolicyUpdateRequest
): Promise<EscalationPolicy> {
  const url = `${getEscalationPoliciesBaseUrl(organizationId)}/${policyId}/`;
  return api.patch<EscalationPolicy>(url, data);
}

/**
 * Get escalation levels for a policy
 * GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/
 */
export async function getEscalationLevels(
  organizationId: string,
  policyId: string
): Promise<EscalationLevel[]> {
  const url = `${getEscalationLevelsBaseUrl(organizationId, policyId)}/`;
  return api.get<EscalationLevel[]>(url);
}

/**
 * Get a single escalation level by ID
 * GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/<level_id>/
 */
export async function getEscalationLevel(
  organizationId: string,
  policyId: string,
  levelId: string
): Promise<EscalationLevel> {
  const url = `${getEscalationLevelsBaseUrl(organizationId, policyId)}/${levelId}/`;
  return api.get<EscalationLevel>(url);
}

/**
 * Create a new escalation level
 * POST /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/
 * 
 * Requires escalation.manage permission
 */
export async function createEscalationLevel(
  organizationId: string,
  policyId: string,
  data: EscalationLevelCreateRequest
): Promise<EscalationLevel> {
  const url = `${getEscalationLevelsBaseUrl(organizationId, policyId)}/`;
  return api.post<EscalationLevel>(url, data);
}

/**
 * Update an escalation level
 * PATCH /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/levels/<level_id>/
 * 
 * Requires escalation.manage permission
 */
export async function updateEscalationLevel(
  organizationId: string,
  policyId: string,
  levelId: string,
  data: EscalationLevelUpdateRequest
): Promise<EscalationLevel> {
  const url = `${getEscalationLevelsBaseUrl(organizationId, policyId)}/${levelId}/`;
  return api.patch<EscalationLevel>(url, data);
}

/**
 * Get escalation rules for a policy
 * GET /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/rules/
 */
export async function getEscalationRules(
  organizationId: string,
  policyId: string
): Promise<EscalationRule[]> {
  const url = `${getEscalationRulesBaseUrl(organizationId, policyId)}/`;
  return api.get<EscalationRule[]>(url);
}

/**
 * Create a new escalation rule
 * POST /api/v1/organizations/<organization_id>/escalation-policies/<policy_id>/rules/
 * 
 * Requires escalation.manage permission
 */
export async function createEscalationRule(
  organizationId: string,
  policyId: string,
  data: EscalationRuleCreateRequest
): Promise<EscalationRule> {
  const url = `${getEscalationRulesBaseUrl(organizationId, policyId)}/`;
  return api.post<EscalationRule>(url, data);
}

/**
 * Get incident escalation history
 * GET /api/v1/organizations/<organization_id>/incidents/<incident_id>/escalations/
 * 
 * Query parameters:
 * - status: filter by escalation status (ACTIVE, COMPLETED, CANCELLED)
 * - trigger_type: filter by trigger type (RESPONSE_BREACH, RESOLUTION_BREACH)
 */
export async function getIncidentEscalations(
  organizationId: string,
  incidentId: string,
  params?: {
    status?: string;
    trigger_type?: string;
  }
): Promise<IncidentEscalation[]> {
  const url = `${getIncidentEscalationsBaseUrl(organizationId, incidentId)}/`;
  return api.get<IncidentEscalation[]>(url, { params });
}

/**
 * Evaluate incident escalation
 * POST /api/v1/organizations/<organization_id>/incidents/<incident_id>/escalations/evaluate/
 * 
 * Requires escalation.evaluate permission
 * This endpoint is idempotent — repeated calls produce no duplicate events
 */
export async function evaluateIncidentEscalation(
  organizationId: string,
  incidentId: string,
  data: EscalationEvaluateRequest
): Promise<IncidentEscalation | { detail: string }> {
  const url = `${getIncidentEscalationsBaseUrl(organizationId, incidentId)}/evaluate/`;
  return api.post<IncidentEscalation | { detail: string }>(url, data);
}
