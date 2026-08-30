/**
 * Tests for audit log hooks: query key factories, permission-aware access,
 * and organization-scoped data fetching (tenant isolation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext, type OrganizationContextValue } from '../../organizations/context/organizationContextDef';
import type { Organization } from '../../organizations/types/organization';
import { useAuditLogs, useCanViewAuditLogs, getAuditLogsQueryKey } from '../hooks/useAuditLogs';
import { getAuditLogQueryKey } from '../hooks/useAuditLog';

const mockApiGet = vi.fn();
vi.mock('../../../api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

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

describe('audit query key factories', () => {
  it('getAuditLogsQueryKey scopes by organization ID and params', () => {
    expect(getAuditLogsQueryKey('org-123', { action: 'incident.created', page: 1 })).toEqual([
      'audit-logs',
      'org-123',
      { action: 'incident.created', page: 1 },
    ]);
  });

  it('getAuditLogsQueryKey handles null organization ID', () => {
    expect(getAuditLogsQueryKey(null)).toEqual(['audit-logs', null, undefined]);
  });

  it('getAuditLogQueryKey scopes by organization and log ID', () => {
    expect(getAuditLogQueryKey('org-123', 'log-1')).toEqual(['audit-log', 'org-123', 'log-1']);
  });

  it('distinct organizations produce distinct list keys (tenant isolation)', () => {
    const keyA = getAuditLogsQueryKey('org-a', undefined)[1];
    const keyB = getAuditLogsQueryKey('org-b', undefined)[1];
    expect(keyA).not.toBe(keyB);
  });
});

describe('useCanViewAuditLogs', () => {
  it('returns true when user has audit_log.view permission', () => {
    const { result } = renderHook(() => useCanViewAuditLogs(), {
      wrapper: createWrapper(mockOrg, ['audit_log.view']),
    });
    expect(result.current).toBe(true);
  });

  it('returns false when user lacks audit_log.view permission', () => {
    const { result } = renderHook(() => useCanViewAuditLogs(), {
      wrapper: createWrapper(mockOrg, ['incident.view']),
    });
    expect(result.current).toBe(false);
  });
});

describe('useAuditLogs', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  });

  it('does not fetch without an active organization', async () => {
    const { result } = renderHook(() => useAuditLogs(), {
      wrapper: createWrapper(null),
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fetches org-scoped audit logs when an organization is active', async () => {
    const { result } = renderHook(() => useAuditLogs(), {
      wrapper: createWrapper(mockOrg, ['audit_log.view']),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/audit-logs/',
      { params: undefined }
    );
  });

  it('forwards filters to the backend request', async () => {
    const { result } = renderHook(() => useAuditLogs({ action: 'role.created', page: 3 }), {
      wrapper: createWrapper(mockOrg, ['audit_log.view']),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/audit-logs/',
      { params: { action: 'role.created', page: 3 } }
    );
  });

  it('surfaces query error to the consumer', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useAuditLogs(), {
      wrapper: createWrapper(mockOrg, ['audit_log.view']),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe('Network failure');
  });
});