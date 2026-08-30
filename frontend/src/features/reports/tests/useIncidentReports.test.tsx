/**
 * Tests for report query key factories and permission hook.
 *
 * Verifies that query key helpers construct organization-scoped keys and
 * that useCanViewReports correctly checks the permission.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext, type OrganizationContextValue } from '../../organizations/context/organizationContextDef';
import type { Organization } from '../../organizations/types/organization';
import { useCanViewReports } from '../hooks/useReports';
import {
  getIncidentReportsQueryKey,
} from '../hooks/useIncidentReports';
import { getSLAReportsQueryKey } from '../hooks/useSLAReports';
import { getEscalationReportsQueryKey } from '../hooks/useEscalationReports';

const mockOrg: Organization = {
  id: 'org-123',
  name: 'Test Org',
  slug: 'test-org',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function createWrapper(org: Organization | null, userPermissions: string[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const contextValue: OrganizationContextValue = {
    organizations: org ? [org] : [],
    currentOrganization: org,
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: !!org,
    selectOrganization: vi.fn(),
    clearCurrentOrganization: vi.fn(),
    createOrganization: vi.fn(),
    refreshOrganizations: vi.fn(),
    hasPermission: (permission: string) => userPermissions.includes(permission),
    getCurrentRole: vi.fn(),
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext.Provider value={contextValue}>
          {children}
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('report query key factories', () => {
  it('getIncidentReportsQueryKey returns correct key', () => {
    expect(getIncidentReportsQueryKey('org-123', 'summary')).toEqual([
      'reports',
      'org-123',
      'incidents',
      'summary',
    ]);
  });

  it('getSLAReportsQueryKey returns correct key', () => {
    expect(getSLAReportsQueryKey('org-123', 'performance')).toEqual([
      'reports',
      'org-123',
      'sla',
      'performance',
    ]);
  });

  it('getEscalationReportsQueryKey returns correct key', () => {
    expect(getEscalationReportsQueryKey('org-123', 'activity')).toEqual([
      'reports',
      'org-123',
      'escalations',
      'activity',
    ]);
  });

  it('query keys handle null organization ID', () => {
    expect(getIncidentReportsQueryKey(null, 'summary')).toEqual([
      'reports',
      null,
      'incidents',
      'summary',
    ]);
  });
});

describe('useCanViewReports', () => {
  it('returns true when user has report.view permission', () => {
    const { result } = renderHook(() => useCanViewReports(), {
      wrapper: createWrapper(mockOrg, ['report.view']),
    });
    expect(result.current).toBe(true);
  });

  it('returns false when user lacks report.view permission', () => {
    const { result } = renderHook(() => useCanViewReports(), {
      wrapper: createWrapper(mockOrg, ['incident.view']),
    });
    expect(result.current).toBe(false);
  });
});

