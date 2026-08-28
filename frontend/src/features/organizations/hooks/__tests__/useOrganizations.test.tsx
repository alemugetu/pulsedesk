import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrganizations, useCreateOrganization, organizationKeys } from '../useOrganizations';
import * as organizationService from '../../services/organizationService';

vi.mock('../../services/organizationService');
const mockedService = vi.mocked(organizationService);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockOrgs = [
  { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE' as const, created_at: '2025-01-01', updated_at: '2025-01-01' },
  { id: 'org-2', name: 'Globex', slug: 'globex', status: 'ACTIVE' as const, created_at: '2025-01-01', updated_at: '2025-01-01' },
];

describe('useOrganizations', () => {
  it('fetches organizations', async () => {
    mockedService.getOrganizations.mockResolvedValue(mockOrgs);

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOrgs);
    expect(mockedService.getOrganizations).toHaveBeenCalled();
  });
});

describe('useCreateOrganization', () => {
  it('creates organization and invalidates cache', async () => {
    const newOrg = { id: 'org-new', name: 'New', slug: 'new', status: 'ACTIVE' as const, created_at: '2025-01-01', updated_at: '2025-01-01' };
    mockedService.createOrganization.mockResolvedValue(newOrg);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Pre-populate the cache
    queryClient.setQueryData(organizationKeys.list(), mockOrgs);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    // Trigger the mutation
    result.current.mutate({ name: 'New' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(newOrg);
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
