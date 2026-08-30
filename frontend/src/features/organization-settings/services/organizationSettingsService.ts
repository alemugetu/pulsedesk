/**
 * Organization Settings service for PulseDesk.
 * 
 * Handles all organization settings API calls using the existing API client.
 * Based on backend API contract in backend/apps/settings/
 * 
 * Endpoints:
 * - GET /api/v1/organizations/{organization_id}/settings/ - Get organization settings
 * - PATCH /api/v1/organizations/{organization_id}/settings/ - Update organization settings
 * 
 * Backend permissions:
 * - GET: settings.view
 * - PATCH: settings.manage
 */

import { api } from '../../../api/client';
import type {
  OrganizationSettings,
  OrganizationSettingsUpdateRequest,
  OrganizationSettingsUpdateResponse,
} from '../types/organizationSettings.types';

/**
 * Build organization-scoped URL for settings
 */
function getSettingsBaseUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/settings`;
}

/**
 * Get organization settings
 * GET /api/v1/organizations/{organization_id}/settings/
 * 
 * Requires: settings.view permission
 * 
 * @param organizationId - The organization UUID
 * @returns Organization settings
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettings> {
  const url = `${getSettingsBaseUrl(organizationId)}/`;
  return api.get<OrganizationSettings>(url);
}

/**
 * Update organization settings (partial update)
 * PATCH /api/v1/organizations/{organization_id}/settings/
 * 
 * Requires: settings.manage permission
 * 
 * Only fields present in the request are updated.
 * Unknown fields are rejected with 400 error.
 * 
 * @param organizationId - The organization UUID
 * @param data - Partial settings update (all fields optional)
 * @returns Updated organization settings
 */
export async function updateOrganizationSettings(
  organizationId: string,
  data: OrganizationSettingsUpdateRequest
): Promise<OrganizationSettingsUpdateResponse> {
  const url = `${getSettingsBaseUrl(organizationId)}/`;
  return api.patch<OrganizationSettingsUpdateResponse>(url, data);
}
