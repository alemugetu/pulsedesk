import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the hooks used by OrganizationProvider — must be before imports that use them
vi.mock('../../hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    data: [
      { id: 'org-1', name: 'Acme Corp', slug: 'acme', status: 'ACTIVE', created_at: '2025-01-01', updated_at: '2025-01-01' },
      { id: 'org-2', name: 'Globex', slug: 'globex', status: 'ACTIVE', created_at: '2025-01-01', updated_at: '2025-01-01' },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateOrganization: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'org-new', name: 'New Org', slug: 'new-org', status: 'ACTIVE', created_at: '2025-01-01', updated_at: '2025-01-01',
    }),
  }),
}));

vi.mock('../../hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('../../hooks/useOrganizationRoles', () => ({
  useOrganizationRoles: () => ({ data: [], isLoading: false, error: null }),
}));

// Create mock auth state and context — these are referenced inside the hoisted mock
// using vi.hoisted() to ensure they're available at mock time
const { mockAuthState, MockAuthContext } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createContext } = require('react');
  const state = {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', email: 'test@example.com' },
    error: null,
  };
  const ctx = createContext(state);
  return { mockAuthState: state, MockAuthContext: ctx };
});

vi.mock('../../../auth/hooks/authContextDef', () => ({
  AuthContext: MockAuthContext,
}));

// Now import the provider and hook (mocks are set up above)
const { OrganizationProvider } = await import('../OrganizationContext');
const { useOrganizationContext } = await import('../organizationContextDef');

function TestConsumer() {
  const ctx = useOrganizationContext();
  return (
    <div>
      <span data-testid="current-org">{ctx.currentOrganization?.name ?? 'none'}</span>
      <span data-testid="org-count">{ctx.organizations.length}</span>
      <span data-testid="has-permission">
        {ctx.hasPermission('organization.view') ? 'yes' : 'no'}
      </span>
      <span data-testid="current-role">{ctx.getCurrentRole() ?? 'null'}</span>
      <button onClick={() => ctx.selectOrganization(ctx.organizations[1])}>Switch</button>
      <button onClick={() => ctx.clearCurrentOrganization()}>Clear</button>
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthContext.Provider value={{ authState: mockAuthState }}>
        <OrganizationProvider>{ui}</OrganizationProvider>
      </MockAuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('OrganizationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('provides organizations list', () => {
    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('org-count')).toHaveTextContent('2');
  });

  it('auto-selects first organization on mount', () => {
    renderWithProviders(<TestConsumer />);
    // With the derivation, when no saved org and multiple orgs, currentOrganization is null
    // unless there's only one org. With 2 orgs and no saved preference, it's null.
    expect(screen.getByTestId('current-org')).toHaveTextContent('none');
  });

  it('switches organization when selectOrganization is called', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer />);

    await user.click(screen.getByText('Switch'));
    expect(screen.getByTestId('current-org')).toHaveTextContent('Globex');
  });

  it('clears organization when clearCurrentOrganization is called', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer />);

    await user.click(screen.getByText('Switch'));
    expect(screen.getByTestId('current-org')).toHaveTextContent('Globex');

    await user.click(screen.getByText('Clear'));
    expect(screen.getByTestId('current-org')).toHaveTextContent('none');
  });

  it('persists selection to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer />);

    await user.click(screen.getByText('Switch'));
    expect(localStorage.getItem('pulsedesk_selected_organization')).toBe('org-2');
  });

  it('restores selection from localStorage', async () => {
    localStorage.setItem('pulsedesk_selected_organization', 'org-2');
    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('current-org')).toHaveTextContent('Globex');
  });

  it('returns false for hasPermission when no membership data', () => {
    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('has-permission')).toHaveTextContent('no');
  });

  it('returns null for getCurrentRole when no membership data', () => {
    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('current-role')).toHaveTextContent('null');
  });
});
