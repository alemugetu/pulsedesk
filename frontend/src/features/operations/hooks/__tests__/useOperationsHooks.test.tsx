/**
 * Tests for the Operations Command Center hooks.
 *
 * Verifies organization-scoped query keys, the enabled gate when no
 * organization is selected, and that backend-supported parameters are
 * forwarded to the service layer. No API calls are issued without a selected
 * organization (tenant isolation).
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOperationsSummary, getOperationsSummaryQueryKey } from '../useOperationsSummary';
import { useOperationsPriorityDistribution } from '../useOperationsPriorityDistribution';
import { useOperationsSla } from '../useOperationsSla';
import { useOperationsEscalations } from '../useOperationsEscalations';
import { useOperationsIncidents, getOperationsIncidentsQueryKey } from '../useOperationsIncidents';
import { useOperationsActiveIncidents } from '../useOperationsActiveIncidents';
import { useOperationsStatusDistribution } from '../useOperationsStatusDistribution';

const { mockUseCurrentOrganization } = vi.hoisted(() => ({
  mockUseCurrentOrganization: vi.fn(),
}));

const {
  mockGetSummary,
  mockGetPriorityDistribution,
  mockGetSlaMetrics,
  mockGetEscalationMetrics,
  mockGetDashboardIncidents,
  mockGetOperationsActiveIncidents,
  mockGetIncidentStatusDistribution,
} = vi.hoisted(() => ({
  mockGetSummary: vi.fn(),
  mockGetPriorityDistribution: vi.fn(),
  mockGetSlaMetrics: vi.fn(),
  mockGetEscalationMetrics: vi.fn(),
  mockGetDashboardIncidents: vi.fn(),
  mockGetOperationsActiveIncidents: vi.fn(),
  mockGetIncidentStatusDistribution: vi.fn(),
}));

vi.mock('../../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => mockUseCurrentOrganization(),
}));

vi.mock('../../services/operationsService', () => ({
  getOperationsSummary: (...args: unknown[]) => mockGetSummary(...args),
  getPriorityDistribution: (...args: unknown[]) => mockGetPriorityDistribution(...args),
  getSlaMetrics: (...args: unknown[]) => mockGetSlaMetrics(...args),
  getEscalationMetrics: (...args: unknown[]) => mockGetEscalationMetrics(...args),
  getDashboardIncidents: (...args: unknown[]) => mockGetDashboardIncidents(...args),
  getOperationsActiveIncidents: (...args: unknown[]) => mockGetOperationsActiveIncidents(...args),
  getIncidentStatusDistribution: (...args: unknown[]) => mockGetIncidentStatusDistribution(...args),
}));

describe('operations hooks', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUseCurrentOrganization.mockReset();
    mockGetSummary.mockReset();
    mockGetPriorityDistribution.mockReset();
    mockGetSlaMetrics.mockReset();
    mockGetEscalationMetrics.mockReset();
    mockGetDashboardIncidents.mockReset();
    mockGetOperationsActiveIncidents.mockReset();
    mockGetIncidentStatusDistribution.mockReset();
  });

  describe.each([
    ['useOperationsSummary', () => useOperationsSummary(), () => mockGetSummary],
    ['useOperationsPriorityDistribution', () => useOperationsPriorityDistribution(), () => mockGetPriorityDistribution],
    ['useOperationsSla', () => useOperationsSla(), () => mockGetSlaMetrics],
    ['useOperationsEscalations', () => useOperationsEscalations(), () => mockGetEscalationMetrics],
    ['useOperationsStatusDistribution', () => useOperationsStatusDistribution(), () => mockGetIncidentStatusDistribution],
  ])('%s', (name, useFn, serviceGetter) => {
    // describe.each widens useFn to a union of hook signatures; renderHook
    // needs one concrete signature, so narrow it for the render call.
    const render = (wrapperEl: React.JSXElementConstructor<{ children: React.ReactNode }>) =>
      renderHook(useFn as () => UseQueryResult<unknown, Error>, { wrapper: wrapperEl });
    it('is disabled and does not call the service without an organization', () => {
      mockUseCurrentOrganization.mockReturnValue(null);

      const { result } = render(wrapper);

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(serviceGetter()).not.toHaveBeenCalled();
    });

    it('calls the service scoped to the current organization', async () => {
      mockUseCurrentOrganization.mockReturnValue({ id: 'org-123', name: 'Acme' });
      (serviceGetter() as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { result } = render(wrapper);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(serviceGetter()).toHaveBeenCalledWith('org-123');
    });
  });

  describe('useOperationsIncidents', () => {
    it('forwards backend-supported filters to the service', async () => {
      mockUseCurrentOrganization.mockReturnValue({ id: 'org-123', name: 'Acme' });
      mockGetDashboardIncidents.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });

      const filters = { status: 'OPEN' as const, priority: 'P1' as const, ordering: '-created_at', page_size: 5 };
      const { result } = renderHook(() => useOperationsIncidents(filters), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGetDashboardIncidents).toHaveBeenCalledWith('org-123', filters);
    });

    it('builds an organization-scoped query key including filters', () => {
      const filters = { status: 'OPEN' as const };
      const key = getOperationsIncidentsQueryKey('org-123', filters);

      expect(key).toEqual(['operations', 'org-123', 'incidents', filters]);
    });
  });

  describe('useOperationsActiveIncidents', () => {
    it('requests the merged active incidents with the limit', async () => {
      mockUseCurrentOrganization.mockReturnValue({ id: 'org-123', name: 'Acme' });
      mockGetOperationsActiveIncidents.mockResolvedValue([]);

      const { result } = renderHook(() => useOperationsActiveIncidents(5), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGetOperationsActiveIncidents).toHaveBeenCalledWith('org-123', 5);
    });
  });

  describe('getOperationsSummaryQueryKey', () => {
    it('is deterministic and organization-scoped', () => {
      expect(getOperationsSummaryQueryKey('org-a')).toEqual(['operations', 'org-a', 'summary']);
      expect(getOperationsSummaryQueryKey('org-b')).toEqual(['operations', 'org-b', 'summary']);
      expect(getOperationsSummaryQueryKey('org-a')).toEqual(['operations', 'org-a', 'summary']);
    });
  });
});