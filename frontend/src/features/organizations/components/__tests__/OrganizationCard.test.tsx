import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationCard } from '../OrganizationCard';
import type { Organization } from '../../types/organization';

const mockOrg: Organization = {
  id: 'org-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  status: 'ACTIVE',
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
};

describe('OrganizationCard', () => {
  it('renders organization name', () => {
    render(<OrganizationCard organization={mockOrg} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders organization slug', () => {
    render(<OrganizationCard organization={mockOrg} />);
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
  });

  it('renders status badge for ACTIVE status', () => {
    render(<OrganizationCard organization={mockOrg} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders status badge for SUSPENDED status', () => {
    const suspendedOrg = { ...mockOrg, status: 'SUSPENDED' as const };
    render(<OrganizationCard organization={suspendedOrg} />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('renders status badge for ARCHIVED status', () => {
    const archivedOrg = { ...mockOrg, status: 'ARCHIVED' as const };
    render(<OrganizationCard organization={archivedOrg} />);
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('shows current indicator when isCurrent is true', () => {
    render(<OrganizationCard organization={mockOrg} isCurrent />);
    expect(screen.getByText('Current organization')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('does not show current indicator when isCurrent is false', () => {
    render(<OrganizationCard organization={mockOrg} isCurrent={false} />);
    expect(screen.queryByText('Current organization')).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OrganizationCard organization={mockOrg} onSelect={onSelect} />);

    await user.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockOrg);
  });

  it('has accessible label', () => {
    render(<OrganizationCard organization={mockOrg} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Select Acme Corp organization'
    );
  });
});
