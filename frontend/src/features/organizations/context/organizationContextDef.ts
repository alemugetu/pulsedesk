/**
 * Organization context definition for PulseDesk.
 *
 * Holds the React context object and consumer hooks, separated from the
 * provider component to avoid Fast Refresh warnings.
 */

import { createContext, useContext } from 'react';
import type { Organization } from '../types/organization';
import type { CreateOrganizationRequest } from '../types/organization';

export interface OrganizationContextValue {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoadingOrganizations: boolean;
  isLoadingCurrent: boolean;
  organizationsError: string | null;
  currentError: string | null;
  hasOrganizations: boolean;
  selectOrganization: (organization: Organization) => void;
  clearCurrentOrganization: () => void;
  createOrganization: (data: CreateOrganizationRequest) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  getCurrentRole: () => string | null;
}

export const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

/**
 * Hook to use organization context
 * Throws error if used outside OrganizationProvider
 */
export function useOrganizationContext(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
}

/**
 * Hook to get current organization
 * Returns null if no organization is selected
 */
export function useCurrentOrganization(): Organization | null {
  const { currentOrganization } = useOrganizationContext();
  return currentOrganization;
}

/**
 * Hook to check if user has access to any organizations
 */
export function useHasOrganizations(): boolean {
  const { hasOrganizations, isLoadingOrganizations } = useOrganizationContext();
  return hasOrganizations && !isLoadingOrganizations;
}

/**
 * Hook to get optional organization context
 * Returns undefined if used outside OrganizationProvider instead of throwing
 */
export function useOptionalOrganizationContext(): OrganizationContextValue | undefined {
  return useContext(OrganizationContext);
}
