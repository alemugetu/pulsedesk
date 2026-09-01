import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrganizationMembers } from '../OrganizationMembers';

// Mock the hooks used by OrganizationMembers
const mockUseOrganizationMembers = vi.fn();
vi.mock('../../hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: (orgId: string) => mockUseOrganizationMembers(orgId),
  useAssignMembershipRole: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateMemberStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useRegisterAndAddMember: () => ({ mutate: vi.fn(), isPending: false }),
  useAddMember: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useOrganizationRoles', () => ({
  useOrganizationRoles: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('../../context/organizationContextDef', () => ({
  useOrganizationContext: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme Corp' },
    hasPermission: () => true,
  }),
}));

const mockMembers = [
  {
    id: 'mem-1',
    user: { id: 'user-1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith' },
    role: { id: 'role-1', name: 'Owner', slug: 'organization-owner' },
    status: 'ACTIVE' as const,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'mem-2',
    user: { id: 'user-2', email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones' },
    role: { id: 'role-2', name: 'Agent', slug: 'agent' },
    status: 'ACTIVE' as const,
    created_at: '2025-01-16T10:00:00Z',
    updated_at: '2025-01-16T10:00:00Z',
  },
];

describe('OrganizationMembers', () => {
  it('renders loading state', () => {
    mockUseOrganizationMembers.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });
    render(<OrganizationMembers organizationId="org-1" />);
    expect(screen.getByText('Loading members...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseOrganizationMembers.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to load'),
    });
    render(<OrganizationMembers organizationId="org-1" />);
    expect(screen.getByText('Error loading members')).toBeInTheDocument();
  });

  it('renders empty state when no members', () => {
    mockUseOrganizationMembers.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    render(<OrganizationMembers organizationId="org-1" />);
    expect(screen.getByText(/No members in this organization/i)).toBeInTheDocument();
  });

  it('renders member list with user info and roles', () => {
    mockUseOrganizationMembers.mockReturnValue({
      data: mockMembers,
      isLoading: false,
      error: null,
    });
    render(<OrganizationMembers organizationId="org-1" />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });
});
