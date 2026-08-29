import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import { AttachmentSection } from '../components/AttachmentSection';
import * as hooks from '../hooks/useAttachments';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ authState: { user: { id: 'u1', email: 'me@example.com' } } }),
}));

const INCIDENT_ID = 'inc-1';

function wrap(ui: React.ReactElement, perms: readonly string[] = ['incident.view']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ctxValue = {
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
    hasPermission: (p: string) => perms.includes(p),
    getCurrentRole: () => 'member',
  } as const;
  return render(
    <QueryClientProvider client={qc}>
      <OrganizationContext.Provider value={ctxValue as never}>
        {ui}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

const commonHookExtras = {
  isFetched: true,
  isFetching: false,
  refetch: vi.fn(),
  isStale: false,
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
};

describe('AttachmentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows permission denial without incident.view', () => {
    vi.spyOn(hooks, 'useAttachments').mockReturnValue({
      attachments: [],
      invalidateAttachments: vi.fn(),
      isLoading: false,
      isError: false,
      error: null,
      data: undefined,
      isSuccess: true,
      status: 'success',
      ...commonHookExtras,
    } as never);

    wrap(<AttachmentSection incidentId={INCIDENT_ID} />, [] as const);
    expect(
      screen.getByText(/You do not have permission to view attachments/)
    ).toBeInTheDocument();
  });

  it('renders Loading state while fetching', () => {
    vi.spyOn(hooks, 'useAttachments').mockReturnValue({
      attachments: [],
      invalidateAttachments: vi.fn(),
      isLoading: true,
      isError: false,
      error: null,
      data: undefined,
      isSuccess: false,
      status: 'pending',
      ...commonHookExtras,
      isFetching: true,
      isFetched: false,
      isPending: true,
      fetchStatus: 'fetching',
    } as never);

    wrap(<AttachmentSection incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('attachments-loading')).toBeInTheDocument();
  });

  it('renders EmptyState when no attachments and upload form', () => {
    vi.spyOn(hooks, 'useAttachments').mockReturnValue({
      attachments: [],
      invalidateAttachments: vi.fn(),
      isLoading: false,
      isError: false,
      error: null,
      data: { count: 0, next: null, previous: null, results: [] },
      isSuccess: true,
      status: 'success',
      ...commonHookExtras,
    } as never);

    wrap(<AttachmentSection incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('attachments-empty')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-upload')).toBeInTheDocument();
  });

  it('renders ErrorState when query fails', () => {
    vi.spyOn(hooks, 'useAttachments').mockReturnValue({
      attachments: [],
      invalidateAttachments: vi.fn(),
      isLoading: false,
      isError: true,
      error: { message: 'DB boom' },
      data: undefined,
      isSuccess: false,
      status: 'error',
      ...commonHookExtras,
    } as never);

    wrap(<AttachmentSection incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('attachments-error')).toBeInTheDocument();
  });
});
