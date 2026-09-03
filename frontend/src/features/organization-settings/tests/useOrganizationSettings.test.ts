/**
 * Tests for useOrganizationSettings hook
 * 
 * Tests TanStack Query integration with organization scoping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useOrganizationSettings, getOrganizationSettingsQueryKey } from '../hooks/useOrganizationSettings';
import { getOrganizationSettings, updateOrganizationSettings } from '../services/organizationSettingsService';

// Mock the services
vi.mock('../services/organizationSettingsService', () => ({
  getOrganizationSettings: vi.fn(),
  updateOrganizationSettings: vi.fn(),
}));

// Mock the organization context
vi.mock('../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: vi.fn(),
}));

import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import type { Organization } from '../../organizations/types/organization';

// Helper to create partial organization mocks
function createMockOrganization(overrides: Partial<Organization>): Organization {
  return {
    id: 'org-123',
    name: 'Test Org',
    slug: 'test-org',
    status: 'ACTIVE',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useOrganizationSettings', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  describe('query key generation', () => {
    it('should generate correct query key with organization ID', () => {
      const queryKey = getOrganizationSettingsQueryKey('org-123');
      expect(queryKey).toEqual(['organization-settings', 'org-123']);
    });

    it('should generate query key with null when no organization', () => {
      const queryKey = getOrganizationSettingsQueryKey(null);
      expect(queryKey).toEqual(['organization-settings', null]);
    });
  });

  describe('fetching settings', () => {
    it('should fetch settings when organization is available', async () => {
      const mockOrganization = createMockOrganization({ id: 'org-123' });
      vi.mocked(useCurrentOrganization).mockReturnValue(mockOrganization);

      const mockSettings = {
        id: 'settings-1',
        default_incident_priority: 'P3' as const,
        default_incident_status: 'OPEN' as const,
        incident_comments_enabled: true,
        notification_incident_emails_enabled: true,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getOrganizationSettings).mockResolvedValue(mockSettings);

      const { result } = renderHook(() => useOrganizationSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getOrganizationSettings).toHaveBeenCalledWith('org-123');
      expect(result.current.data).toEqual(mockSettings);
    });

    it('should not fetch when organization is not available', () => {
      vi.mocked(useCurrentOrganization).mockReturnValue(null);

      const { result } = renderHook(() => useOrganizationSettings(), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
      expect(getOrganizationSettings).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const mockOrganization = createMockOrganization({ id: 'org-123', name: 'Test Org' });
      vi.mocked(useCurrentOrganization).mockReturnValue(mockOrganization);

      vi.mocked(getOrganizationSettings).mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useOrganizationSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('organization scoping', () => {
    it('should refetch when organization changes', async () => {
      const mockOrg1 = createMockOrganization({ id: 'org-123', name: 'Org 1', slug: 'org-1' });
      const mockOrg2 = createMockOrganization({ id: 'org-456', name: 'Org 2', slug: 'org-2' });

      const mockSettings1 = {
        id: 'settings-1',
        default_incident_priority: 'P3' as const,
        default_incident_status: 'OPEN' as const,
        incident_comments_enabled: true,
        notification_incident_emails_enabled: true,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockSettings2 = {
        id: 'settings-2',
        default_incident_priority: 'P1' as const,
        default_incident_status: 'OPEN' as const,
        incident_comments_enabled: false,
        notification_incident_emails_enabled: false,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: false,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(useCurrentOrganization).mockReturnValue(mockOrg1);
      vi.mocked(getOrganizationSettings).mockResolvedValue(mockSettings1);

      const { result, rerender } = renderHook(() => useOrganizationSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockSettings1);

      // Switch organization
      vi.mocked(useCurrentOrganization).mockReturnValue(mockOrg2);
      vi.mocked(getOrganizationSettings).mockResolvedValue(mockSettings2);

      rerender();

      await waitFor(() => expect(result.current.data).toEqual(mockSettings2));

      expect(getOrganizationSettings).toHaveBeenCalledWith('org-456');
    });
  });

  describe('updating settings', () => {
    it('should update settings and cache', async () => {
      const mockOrganization: Organization = {
        id: 'org-123',
        name: 'Test Org',
        slug: 'test-org',
        status: 'ACTIVE',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      vi.mocked(useCurrentOrganization).mockReturnValue(mockOrganization);

      const mockSettings = {
        id: 'settings-1',
        default_incident_priority: 'P3' as const,
        default_incident_status: 'OPEN' as const,
        incident_comments_enabled: true,
        notification_incident_emails_enabled: true,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockUpdatedSettings = {
        id: 'settings-1',
        default_incident_priority: 'P2' as const,
        default_incident_status: 'OPEN' as const,
        incident_comments_enabled: false,
        notification_incident_emails_enabled: true,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(getOrganizationSettings).mockResolvedValue(mockSettings);
      vi.mocked(updateOrganizationSettings).mockResolvedValue(mockUpdatedSettings);

      const { result } = renderHook(() => useOrganizationSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const updateData = {
        default_incident_priority: 'P2' as const,
        incident_comments_enabled: false,
      };

      result.current.updateSettings(updateData);

      await waitFor(() => expect(result.current.isUpdating).toBe(false));

      expect(updateOrganizationSettings).toHaveBeenCalledWith('org-123', updateData);
      expect(result.current.data).toEqual(mockUpdatedSettings);
    });
  });
});
