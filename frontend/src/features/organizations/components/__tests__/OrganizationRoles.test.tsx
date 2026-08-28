import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrganizationRoles } from '../OrganizationRoles';

// Mock the useOrganizationRoles hook
const mockUseOrganizationRoles = vi.fn();
vi.mock('../../hooks/useOrganizationRoles', () => ({
  useOrganizationRoles: (orgId: string) => mockUseOrganizationRoles(orgId),
}));

const mockRoles = [
  {
    id: 'role-1',
    name: 'Owner',
    slug: 'organization-owner',
    description: 'Full access',
    is_system_role: true,
    permissions: ['organization.view', 'organization.update', 'member.view', 'member.invite'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'role-2',
    name: 'Custom Role',
    slug: 'custom-role',
    description: 'A custom role',
    is_system_role: false,
    permissions: ['member.view', 'role.view'],
    created_at: '2025-02-01T00:00:00Z',
    updated_at: '2025-02-01T00:00:00Z',
  },
];

describe('OrganizationRoles', () => {
  it('renders loading state', () => {
    mockUseOrganizationRoles.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });
    render(<OrganizationRoles organizationId="org-1" />);
    expect(screen.getByText('Loading roles...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseOrganizationRoles.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to load'),
    });
    render(<OrganizationRoles organizationId="org-1" />);
    expect(screen.getByText('Error loading roles')).toBeInTheDocument();
  });

  it('renders empty state when no roles', () => {
    mockUseOrganizationRoles.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    render(<OrganizationRoles organizationId="org-1" />);
    expect(screen.getByText('No roles yet')).toBeInTheDocument();
  });

  it('renders role list with permissions', () => {
    mockUseOrganizationRoles.mockReturnValue({
      data: mockRoles,
      isLoading: false,
      error: null,
    });
    render(<OrganizationRoles organizationId="org-1" />);
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Custom Role')).toBeInTheDocument();
  });

  it('shows system role badge for system roles', () => {
    mockUseOrganizationRoles.mockReturnValue({
      data: mockRoles,
      isLoading: false,
      error: null,
    });
    render(<OrganizationRoles organizationId="org-1" />);
    expect(screen.getByText('System')).toBeInTheDocument();
  });
});
