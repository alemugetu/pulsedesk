import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentList } from '../components/CommentList';
import type { Comment } from '../types/comment.types';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import type { OrganizationContextValue } from '../../organizations/context/organizationContextDef';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'current-user', email: 'me@example.com' },
  }),
}));

const mockComments: Comment[] = [
  {
    id: 'cmt-1',
    incident: 'inc-1',
    author: {
      id: 'u1',
      email: 'alice@example.com',
      first_name: 'Alice',
      last_name: 'Smith',
      full_name: 'Alice Smith',
    },
    body: 'First comment',
    is_internal: false,
    mentioned_users: [],
    is_owner: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cmt-2',
    incident: 'inc-1',
    author: {
      id: 'u2',
      email: 'bob@example.com',
      first_name: 'Bob',
      last_name: 'Jones',
      full_name: 'Bob Jones',
    },
    body: 'Second comment with internal note',
    is_internal: true,
    mentioned_users: [],
    is_owner: false,
    created_at: new Date(Date.now() - 60000).toISOString(),
    updated_at: new Date(Date.now() - 60000).toISOString(),
  },
];

function makeCtxValue(permissions: string[] = ['incident.view']): OrganizationContextValue {
  return {
    organizations: [{ id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }],
    currentOrganization: { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
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

function renderWithCtx(ui: React.ReactElement, permissions: string[] = ['incident.view']) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OrganizationContext.Provider value={makeCtxValue(permissions)}>
        {ui}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty list without errors', () => {
    const { container } = renderWithCtx(
      <CommentList comments={[]} />
    );
    expect(screen.queryByTestId('comment-item')).not.toBeInTheDocument();
    expect(container.querySelector('[role="log"]')).toBeInTheDocument();
  });

  it('renders each comment as a CommentItem', () => {
    renderWithCtx(<CommentList comments={mockComments} />);
    const items = screen.getAllByTestId('comment-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('First comment')).toBeInTheDocument();
    expect(screen.getByText('Second comment with internal note')).toBeInTheDocument();
  });

  it('renders internal badge for internal comments', () => {
    renderWithCtx(<CommentList comments={mockComments} />);
    expect(screen.getByText('Internal')).toBeInTheDocument();
  });

  it('uses role=log with aria-live for assistive technology', () => {
    renderWithCtx(<CommentList comments={mockComments} />);
    const list = screen.getByRole('log');
    expect(list).toHaveAttribute('aria-live', 'polite');
  });
});
