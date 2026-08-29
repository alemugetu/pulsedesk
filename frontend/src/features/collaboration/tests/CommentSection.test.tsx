import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import type { OrganizationContextValue } from '../../organizations/context/organizationContextDef';
import { CommentSection } from '../components/CommentSection';
import * as commentHooks from '../hooks/useComments';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@example.com' } }),
}));

const INCIDENT_ID = 'inc-1';

function makeCtxValue(permissions: string[] = ['incident.view']): OrganizationContextValue {
  return {
    organizations: [{ id: 'org-1', name: 'Acme', slug: 'acme', created_at: '2024-01-01T00:00:00Z' }],
    currentOrganization: { id: 'org-1', name: 'Acme', slug: 'acme', created_at: '2024-01-01T00:00:00Z' },
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: true,
    selectOrganization: vi.fn(),
    clearCurrentOrganization: vi.fn(),
    createOrganization: vi.fn(),
    refreshOrganizations: vi.fn(),
    hasPermission: (p: string) => permissions.includes(p),
    getCurrentRole: () => 'member',
  };
}

function wrap(ui: React.ReactElement, perms: string[] = ['incident.view']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrganizationContext.Provider value={makeCtxValue(perms)}>
        {ui}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows permission-denied message when user lacks incident.view', () => {
    vi.spyOn(commentHooks, 'useComments').mockReturnValue({
      comments: [],
      invalidateComments: vi.fn(),
      isLoading: false,
      isError: false,
      error: null,
      data: undefined,
      isFetched: true,
      isFetching: false,
      refetch: vi.fn(),
      status: 'success',
      isStale: false,
      isSuccess: true,
      isIdle: false,
      isPending: false,
      failureCount: 0,
      failureReason: null,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      fetchStatus: 'idle',
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      promise: Promise.resolve({ data: undefined, status: 'success', fetchStatus: 'idle' }) as never,
    } as never);

    wrap(<CommentSection incidentId={INCIDENT_ID} />, []);
    expect(screen.getByText(/You do not have permission to view comments/)).toBeInTheDocument();
    expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
  });

  it('shows loading state when data is loading', async () => {
    vi.spyOn(commentHooks, 'useComments').mockReturnValue({
      comments: [],
      invalidateComments: vi.fn(),
      isLoading: true,
      isError: false,
      error: null,
      data: undefined,
      isFetched: false,
      isFetching: true,
      refetch: vi.fn(),
      status: 'pending',
      isStale: false,
      isSuccess: false,
      isIdle: false,
      isPending: true,
      failureCount: 0,
      failureReason: null,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      fetchStatus: 'fetching',
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      promise: Promise.resolve({ data: undefined, status: 'pending', fetchStatus: 'fetching' }) as never,
    } as never);

    wrap(<CommentSection incidentId={INCIDENT_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId('comments-loading')).toBeInTheDocument();
    });
  });

  it('shows EmptyState when no comments exist', () => {
    vi.spyOn(commentHooks, 'useComments').mockReturnValue({
      comments: [],
      invalidateComments: vi.fn(),
      isLoading: false,
      isError: false,
      error: null,
      data: { count: 0, next: null, previous: null, results: [] },
      isFetched: true,
      isFetching: false,
      refetch: vi.fn(),
      status: 'success',
      isStale: false,
      isSuccess: true,
      isIdle: false,
      isPending: false,
      failureCount: 0,
      failureReason: null,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      fetchStatus: 'idle',
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      promise: Promise.resolve({ data: undefined, status: 'success', fetchStatus: 'idle' }) as never,
    } as never);

    wrap(<CommentSection incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('comments-empty')).toBeInTheDocument();
    expect(screen.getByTestId('comment-form')).toBeInTheDocument();
  });

  it('shows ErrorState with retry when fetching fails', () => {
    const refetch = vi.fn();
    vi.spyOn(commentHooks, 'useComments').mockReturnValue({
      comments: [],
      invalidateComments: vi.fn(),
      isLoading: false,
      isError: true,
      error: { message: 'Boom' },
      data: undefined,
      isFetched: true,
      isFetching: false,
      refetch,
      status: 'error',
      isStale: false,
      isSuccess: false,
      isIdle: false,
      isPending: false,
      failureCount: 1,
      failureReason: null,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      fetchStatus: 'idle',
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      promise: Promise.resolve({ data: undefined, status: 'error', fetchStatus: 'idle' }) as never,
    } as never);

    wrap(<CommentSection incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('comments-error')).toBeInTheDocument();
  });
});
