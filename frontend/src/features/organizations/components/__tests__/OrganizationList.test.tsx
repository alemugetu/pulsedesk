import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationList } from '../OrganizationList';
import type { Organization } from '../../types/organization';

const mockOrgs: Organization[] = [
  {
    id: 'org-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'ACTIVE',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'org-2',
    name: 'Globex Inc',
    slug: 'globex-inc',
    status: 'ACTIVE',
    created_at: '2025-02-01T10:00:00Z',
    updated_at: '2025-02-01T10:00:00Z',
  },
];

describe('OrganizationList', () => {
  it('renders loading state', () => {
    render(<OrganizationList organizations={[]} isLoading />);
    expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<OrganizationList organizations={[]} error="Network error" />);
    expect(screen.getByText('Error loading organizations')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders empty state when no organizations', () => {
    render(<OrganizationList organizations={[]} />);
    expect(screen.getByText('No organizations yet')).toBeInTheDocument();
  });

  it('renders organization list', () => {
    render(<OrganizationList organizations={mockOrgs} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Globex Inc')).toBeInTheDocument();
  });

  it('renders with list role and label', () => {
    render(<OrganizationList organizations={mockOrgs} />);
    expect(screen.getByRole('list', { name: 'Organizations' })).toBeInTheDocument();
  });

  it('calls onSelectOrganization when an organization card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OrganizationList organizations={mockOrgs} onSelectOrganization={onSelect} />);

    await user.click(screen.getByText('Acme Corp'));
    expect(onSelect).toHaveBeenCalledWith(mockOrgs[0]);
  });

  it('marks current organization', () => {
    render(<OrganizationList organizations={mockOrgs} currentOrganizationId="org-1" />);
    const buttons = screen.getAllByRole('button');
    // The first card button should have aria-current="true"
    const acmeButton = buttons.find(btn =>
      btn.getAttribute('aria-label')?.includes('Acme Corp')
    );
    expect(acmeButton).toHaveAttribute('aria-current', 'true');
  });
});
