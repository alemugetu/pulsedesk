import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import { CommentForm } from '../components/CommentForm';
import * as hooks from '../hooks/useCreateComment';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@example.com' } }),
}));

const INCIDENT_ID = 'inc-1';

function wrap(ui: React.ReactElement) {
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
    hasPermission: (p: string) => ['incident.view'].includes(p),
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

describe('CommentForm', () => {
  let mutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync = vi.fn().mockResolvedValue({ id: 'cmt-1' });
    vi.spyOn(hooks, 'useCreateComment').mockReturnValue({
      isPending: false,
      mutateAsync,
      mutate: vi.fn(),
      error: null,
      isError: false,
      isIdle: true,
      isSuccess: false,
      reset: vi.fn(),
      status: 'idle',
      data: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
      variables: undefined,
      context: undefined,
    } as never);
  });

  it('renders textarea, internal checkbox, and submit button', () => {
    wrap(<CommentForm incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('comment-body-input')).toBeInTheDocument();
    expect(screen.getByTestId('comment-internal-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('comment-submit-button')).toBeInTheDocument();
  });

  it('shows client validation error when submitting empty body', async () => {
    wrap(<CommentForm incidentId={INCIDENT_ID} />);
    const textarea = screen.getByTestId('comment-body-input');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('comment-submit-button'));
    await waitFor(() => {
      expect(screen.getByTestId('comment-form-error')).toBeInTheDocument();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits non-empty body via mutation and resets input', async () => {
    wrap(<CommentForm incidentId={INCIDENT_ID} />);
    const textarea = screen.getByTestId('comment-body-input');
    fireEvent.change(textarea, { target: { value: 'Hello there' } });
    const checkbox = screen.getByTestId('comment-internal-checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByTestId('comment-submit-button'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      body: 'Hello there',
      is_internal: true,
    });
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('disables submit when mutation is pending', () => {
    (vi.spyOn(hooks, 'useCreateComment') as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isPending: true,
      mutateAsync,
      mutate: vi.fn(),
      error: null,
      isError: false,
      isIdle: false,
      isSuccess: false,
      reset: vi.fn(),
      status: 'pending',
      data: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
      variables: undefined,
      context: undefined,
    });
    wrap(<CommentForm incidentId={INCIDENT_ID} />);
    expect(screen.getByTestId('comment-submit-button')).toBeDisabled();
  });
});
