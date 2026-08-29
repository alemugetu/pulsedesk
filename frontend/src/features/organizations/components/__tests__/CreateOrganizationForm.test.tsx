import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateOrganizationForm } from '../CreateOrganizationForm';
import type { Organization } from '../../types/organization';

// Mock the organizationContextDef
const mockCreateOrganization = vi.fn();
vi.mock('../../context/organizationContextDef', () => ({
  useOrganizationContext: () => ({
    createOrganization: mockCreateOrganization,
    isLoadingCurrent: false,
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const mockOrg: Organization = {
  id: 'org-new',
  name: 'New Org',
  slug: 'new-org',
  status: 'ACTIVE',
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
};

describe('CreateOrganizationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    renderWithQuery(<CreateOrganizationForm />);
    expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Slug/i)).toBeInTheDocument();
  });

  it('shows error when name is empty on submit', async () => {
    const user = userEvent.setup();
    renderWithQuery(<CreateOrganizationForm />);

    await user.click(screen.getByRole('button', { name: /Create Organization/i }));
    expect(screen.getByText('Organization name is required')).toBeInTheDocument();
  });

  it('shows error when name is too short', async () => {
    const user = userEvent.setup();
    renderWithQuery(<CreateOrganizationForm />);

    const nameInput = screen.getByLabelText(/Organization Name/i);
    await user.type(nameInput, 'A');
    await user.click(screen.getByRole('button', { name: /Create Organization/i }));
    expect(screen.getByText('Organization name must be at least 2 characters')).toBeInTheDocument();
  });

  it('calls createOrganization on valid submit', async () => {
    const user = userEvent.setup();
    mockCreateOrganization.mockResolvedValue(mockOrg);
    renderWithQuery(<CreateOrganizationForm />);

    const nameInput = screen.getByLabelText(/Organization Name/i);
    await user.type(nameInput, 'Acme Corp');
    await user.click(screen.getByRole('button', { name: /Create Organization/i }));

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      name: 'Acme Corp',
      slug: undefined,
    });
  });

  it('shows success message after successful creation', async () => {
    const user = userEvent.setup();
    mockCreateOrganization.mockResolvedValue(mockOrg);
    renderWithQuery(<CreateOrganizationForm />);

    const nameInput = screen.getByLabelText(/Organization Name/i);
    await user.type(nameInput, 'Acme Corp');
    await user.click(screen.getByRole('button', { name: /Create Organization/i }));

    expect(await screen.findByText(/Organization created successfully/i)).toBeInTheDocument();
  });

  it('shows error message on creation failure', async () => {
    const user = userEvent.setup();
    mockCreateOrganization.mockRejectedValue(new Error('Duplicate name'));
    renderWithQuery(<CreateOrganizationForm />);

    const nameInput = screen.getByLabelText(/Organization Name/i);
    await user.type(nameInput, 'Acme Corp');
    await user.click(screen.getByRole('button', { name: /Create Organization/i }));

    expect(await screen.findByText(/Duplicate name/i)).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithQuery(<CreateOrganizationForm onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
