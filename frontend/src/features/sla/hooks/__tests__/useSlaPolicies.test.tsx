/**
 * Tests for useSlaPolicies hook organization-aware behavior.
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useSlaPolicies, getSlaPoliciesQueryKey } from '../useSlaPolicies';

// Mock the organization context
const mockUseCurrentOrganization = vi.fn();
vi.mock('../../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => mockUseCurrentOrganization(),
}));

// Mock the service
const mockGetSlaPolicies = vi.fn();
vi.mock('../../services/slaService', () => ({
  getSlaPolicies: (...args: unknown[]) => mockGetSlaPolicies(...args),
}));

describe('useSlaPolicies', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockUseCurrentOrganization.mockClear();
    mockGetSlaPolicies.mockClear();
  });

  it('is disabled when organization context is missing', () => {
    mockUseCurrentOrganization.mockReturnValue(null);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSlaPolicies(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockGetSlaPolicies).not.toHaveBeenCalled();
  });

  it('is enabled when organization context is present', () => {
    const mockOrg = { id: 'org-123', name: 'Test Org' };
    mockUseCurrentOrganization.mockReturnValue(mockOrg);
    mockGetSlaPolicies.mockResolvedValue([]);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSlaPolicies(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(mockGetSlaPolicies).toHaveBeenCalledWith('org-123', { is_active: undefined });
  });

  it('uses organization ID in query key', () => {
    const mockOrg = { id: 'org-123', name: 'Test Org' };
    const queryKey = getSlaPoliciesQueryKey(mockOrg.id, true);

    expect(queryKey).toEqual(['sla-policies', 'org-123', true]);
  });

  it('includes isActive filter in service call', () => {
    const mockOrg = { id: 'org-123', name: 'Test Org' };
    mockUseCurrentOrganization.mockReturnValue(mockOrg);
    mockGetSlaPolicies.mockResolvedValue([]);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useSlaPolicies(true), { wrapper });

    expect(mockGetSlaPolicies).toHaveBeenCalledWith('org-123', { is_active: true });
  });
});
