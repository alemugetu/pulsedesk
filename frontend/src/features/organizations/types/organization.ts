/**
 * Organization types for PulseDesk.
 * 
 * Based on the backend API contract from Django REST Framework.
 * Backend models: Organization, OrganizationStatus
 * API endpoints: /api/v1/organizations/
 */

/**
 * Organization status enum matching backend OrganizationStatus
 */
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

/**
 * Organization model matching backend OrganizationSerializer
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

/**
 * Request payload for creating an organization
 * Matches backend OrganizationCreateSerializer
 */
export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
}

/**
 * Response from organization list endpoint
 */
export type OrganizationListResponse = Organization[];

/**
 * Response from organization creation endpoint
 */
export type OrganizationCreateResponse = Organization;

/**
 * Response from organization detail endpoint
 */
export type OrganizationDetailResponse = Organization;
