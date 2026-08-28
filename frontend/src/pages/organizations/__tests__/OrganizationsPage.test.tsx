import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationsPage } from '../OrganizationsPage';

// Mock OrganizationContext
const mockSelectOrganization = vi.fn();
const mockContext = {
  organizations: [
    { id: 'org-1', name: 'Acme Corp', slug: 'acme', status: 'ACTIVE', created_at: '2025-01-01', updated_at: '2025-01-01' },
    { id: 'org-2', name: 'Globex', slug: 'globex', status: 'ACTIVE', created_at: '2025-01-01', updated_at: '2025-01-01' },
  ],
  currentOrganization: null,
  isLoadingOrganizations: false,
  isLoadingCurrent: false,
  organizationsError: null,
  currentError: null,
  hasOrganizations: true,
  selectOrganization: mockSelectOrganization,
  clearCurrentOrganization: vi.fn(),
  createOrganization: vi.fn(),
  refreshOrganizations: vi.fn(),
  hasPermission: vi.fn(() => false),
  getCurrentRole: vi.fn(() => null),
};

vi.mock('../../../features/organizations/context/OrganizationContext', () => ({
  useOrganizationContext: () => mockContext,
}));

function renderPage(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <OrganizationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders organization list by default', () => {
    renderPage();
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
  });

  it('shows Create Organization button in list view', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Create Organization/i })).toBeInTheDocument();
  });

  it('switches to create form when button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Create Organization/i }));
    expect(screen.getByLabelText(/Create organization form/i)).toBeInTheDocument();
  });

  it('shows create form when URL has ?create=true', () => {
    renderPage(['/organizations?create=true']);
    expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument();
  });

  it('renders page header with description', () => {
    renderPage();
    expect(screen.getByText('Manage your organizations and team settings')).toBeInTheDocument();
  });
});
