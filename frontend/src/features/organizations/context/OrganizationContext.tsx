/**
 * Organization Context for PulseDesk.
 * 
 * Provides centralized organization state management with tenant isolation.
 * Integrates with authentication context and handles organization switching.
 * 
 * Key features:
 * - Available organizations for authenticated user
 * - Current/selected organization state
 * - Organization switching with cache invalidation
 * - Tenant-aware query key management
 * - Persistent organization selection
 * - Loading and error states
 * - Integration with authentication lifecycle
 */

import { useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizations, useCreateOrganization } from '../hooks/useOrganizations';
import { useOrganizationMembers } from '../hooks/useOrganizationMembers';
import { useOrganizationRoles } from '../hooks/useOrganizationRoles';
import {
  OrganizationContext,
  type OrganizationContextValue,
} from './organizationContextDef';
import { AuthContext } from '../../auth/hooks/authContextDef';
import type { Organization } from '../types/organization';
import type { CreateOrganizationRequest } from '../types/organization';

/**
 * Storage key for persisting selected organization
 */
const SELECTED_ORG_STORAGE_KEY = 'pulsedesk_selected_organization';

/**
 * Organization Provider Props
 */
interface OrganizationProviderProps {
  children: ReactNode;
}

/**
 * Organization Provider Component
 */
export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const queryClient = useQueryClient();
  const authContext = useContext(AuthContext);
  const authState = authContext?.authState || { isAuthenticated: false, isLoading: true, user: null, error: null };
  
  // Fetch organizations data
  const {
    data: organizations = [],
    isLoading: isLoadingOrganizations,
    error: organizationsError,
    refetch: refetchOrganizations,
  } = useOrganizations();
  
  const createOrganizationMutation = useCreateOrganization();
  
  // Selected organization ID — persisted to localStorage.
  // The full Organization object is derived from this ID + the organizations list.
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_ORG_STORAGE_KEY)
  );
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  // Derive the current organization from ID + list + auth state.
  // Handles auto-selection (single org), stale-ID cleanup, and logout.
  const currentOrganization = useMemo((): Organization | null => {
    // Not authenticated — no current organization
    if (!authState.isAuthenticated) return null;
    if (selectedOrgId) {
      const match = organizations.find(org => org.id === selectedOrgId);
      if (match) return match;
      // Saved ID no longer matches any accessible org — only clear when
      // we have definitive data (list loaded) to avoid wiping during
      // transient empty states.
      if (organizations.length > 0) {
        localStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
      }
      return null;
    }
    // Auto-select when user belongs to exactly one organization
    if (organizations.length === 1) return organizations[0];
    return null;
  }, [selectedOrgId, organizations, authState.isAuthenticated]);

  // Derive the current organization ID for conditional queries
  const currentOrgId = currentOrganization?.id ?? '';

  // Fetch members and roles for the current organization (UX-only, backend is authoritative)
  const { data: members = [] } = useOrganizationMembers(currentOrgId);
  const { data: roles = [] } = useOrganizationRoles(currentOrgId);

  // Derive the current user's membership, role, and permissions
  const { userPermissions, userRoleSlug } = useMemo(() => {
    if (!authState.user || !currentOrgId) {
      return { userPermissions: [] as string[], userRoleSlug: null as string | null };
    }

    // Find the current user's membership in this organization
    const userMembership = members.find(m => m.user.id === authState.user!.id);
    if (!userMembership || !userMembership.role?.id) {
      return { userPermissions: [] as string[], userRoleSlug: userMembership?.role?.slug ?? null };
    }

    // Find the full role to get its permissions
    const userRole = roles.find(r => r.id === userMembership.role.id);
    return {
      userPermissions: userRole?.permissions ?? [],
      userRoleSlug: userMembership.role.slug ?? null,
    };
  }, [authState.user, currentOrgId, members, roles]);
  
  // Persist selected org ID to localStorage (side-effect only, no setState).
  useEffect(() => {
    if (selectedOrgId && authState.isAuthenticated) {
      localStorage.setItem(SELECTED_ORG_STORAGE_KEY, selectedOrgId);
    }
  }, [selectedOrgId, authState.isAuthenticated]);
  
  /**
   * Select an organization as current
   * Invalidates tenant-scoped queries to prevent cross-tenant data leakage
   */
  const selectOrganization = useCallback((organization: Organization) => {
    setSelectedOrgId(organization.id);
    localStorage.setItem(SELECTED_ORG_STORAGE_KEY, organization.id);
    
    // Clear all tenant-scoped queries to prevent cross-tenant data leakage
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        // Clear queries that are organization-scoped
        return Array.isArray(key) && key.some(k =>
          typeof k === 'string' && (
            k.includes('organizations') ||
            k.includes('members') ||
            k.includes('roles') ||
            k.includes('sla') ||
            k.includes('escalation')
          )
        );
      },
    });
    
    setCurrentError(null);
  }, [queryClient]);
  
  /**
   * Clear current organization selection
   */
  const clearCurrentOrganization = useCallback(() => {
    setSelectedOrgId(null);
    localStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
    setCurrentError(null);
  }, []);
  
  /**
   * Create a new organization
   * Automatically selects the newly created organization
   */
  const createOrganization = useCallback(async (data: CreateOrganizationRequest): Promise<Organization> => {
    setIsLoadingCurrent(true);
    setCurrentError(null);
    
    try {
      const newOrg = await createOrganizationMutation.mutateAsync(data);
      
      // Refresh organizations list
      await refetchOrganizations();
      
      // Auto-select the new organization
      selectOrganization(newOrg);
      
      return newOrg;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create organization';
      setCurrentError(errorMessage);
      throw error;
    } finally {
      setIsLoadingCurrent(false);
    }
  }, [createOrganizationMutation, refetchOrganizations, selectOrganization]);
  
  /**
   * Refresh organizations list
   */
  const refreshOrganizations = useCallback(async () => {
    setIsLoadingCurrent(true);
    setCurrentError(null);
    
    try {
      await refetchOrganizations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh organizations';
      setCurrentError(errorMessage);
      throw error;
    } finally {
      setIsLoadingCurrent(false);
    }
  }, [refetchOrganizations]);
  
  /**
   * Check if current user has a specific permission.
   * Frontend UX check only — backend authorization is the security boundary.
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!currentOrganization) {
      return false;
    }
    return userPermissions.includes(permission);
  }, [currentOrganization, userPermissions]);
  
  /**
   * Get current user's role slug in the current organization.
   * Frontend UX helper only — backend authorization is the security boundary.
   */
  const getCurrentRole = useCallback((): string | null => {
    if (!currentOrganization) {
      return null;
    }
    return userRoleSlug;
  }, [currentOrganization, userRoleSlug]);
  
  const value: OrganizationContextValue = {
    // State
    organizations,
    currentOrganization,
    isLoadingOrganizations,
    isLoadingCurrent,
    organizationsError: organizationsError?.message || null,
    currentError,
    hasOrganizations: organizations.length > 0,
    
    // Actions
    selectOrganization,
    clearCurrentOrganization,
    createOrganization,
    refreshOrganizations,
    
    // Permission helpers
    hasPermission,
    getCurrentRole,
  };
  
  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}
