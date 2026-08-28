/**
 * Organization service for PulseDesk.
 * 
 * Handles all organization-related API calls.
 * Based on backend API contract:
 * - GET /api/v1/organizations/ - List user's organizations
 * - POST /api/v1/organizations/ - Create organization
 * - GET /api/v1/organizations/<uuid>/ - Get organization detail
 */

import { api } from '../../../api/client';
import type {
  OrganizationListResponse,
  CreateOrganizationRequest,
  OrganizationCreateResponse,
  OrganizationDetailResponse,
} from '../types/organization';

const ORGANIZATIONS_BASE_URL = '/api/v1/organizations';

/**
 * Get all organizations for the authenticated user
 * GET /api/v1/organizations/
 */
export async function getOrganizations(): Promise<OrganizationListResponse> {
  return api.get<OrganizationListResponse>(ORGANIZATIONS_BASE_URL);
}

/**
 * Create a new organization
 * The authenticated user automatically becomes the Organization Owner
 * POST /api/v1/organizations/
 */
export async function createOrganization(
  data: CreateOrganizationRequest
): Promise<OrganizationCreateResponse> {
  return api.post<OrganizationCreateResponse>(ORGANIZATIONS_BASE_URL, data);
}

/**
 * Get organization details
 * Requires active membership in the organization
 * GET /api/v1/organizations/<uuid>/
 */
export async function getOrganization(
  organizationId: string
): Promise<OrganizationDetailResponse> {
  return api.get<OrganizationDetailResponse>(
    `${ORGANIZATIONS_BASE_URL}/${organizationId}/`
  );
}
