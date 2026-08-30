/**
 * Tests for AuditLogsPage.
 *
 * Verifies permission gating, loading state, error/retry, empty state,
 * list rendering, filter clearing, pagination, and detail interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditLogsPage } from '../../../pages/app/AuditLogsPage';

const mockUseCanViewAuditLogs = vi.fn();
const mockUseAuditLogs = vi.fn();
const mockUseAuditLog = vi.fn();
const mockUseCurrentOrganization = vi.fn();

vi.mock('../hooks/useAuditLogs', () => ({
  useAuditLogs: (...args: unknown[]) => mockUseAuditLogs(...args),
  useCanViewAuditLogs: () => mockUseCanViewAuditLogs(),
}));

vi.mock('../hooks/useAuditLog', () => ({
  useAuditLog: (...args: unknown[]) => mockUseAuditLog(...args),
}));

vi.mock('../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => mockUseCurrentOrganization(),
}));

const sampleLog = {
  id: 'log-1',
  organization: 'org-123',
  actor: { id: 'user-1', email: 'a@b.com', first_name: 'Ana', last_name: 'Doe' },
  action: 'incident.created',
  resource_type: 'incident',
  resource_id: 'inc-42',
  changes: { title: 'DB outage' },
  ip_address: '10.0.0.1',
  created_at: '2026-08-01T10:00:00Z',
};

const sampleResponse = (overrides: Record<string, unknown> = {}) => ({
  count: 1,
  next: null,
  previous: null,
  results: [sampleLog],
  ...overrides,
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUseCanViewAuditLogs.mockReturnValue(true);
  mockUseCurrentOrganization.mockReturnValue({ id: 'org-123' });
  mockUseAuditLogs.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockUseAuditLog.mockImplementation((auditLogId: string | null | undefined) => ({
    data: auditLogId ? sampleLog : undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }));
});

function renderPage() {
  return render(<AuditLogsPage />, { wrapper: createWrapper() });
}

describe('AuditLogsPage', () => {
  it('renders the page header', () => {
    renderPage();
    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText(/Operational and security history for your organization/)).toBeInTheDocument();
  });

  it('shows access restricted when user lacks audit_log.view permission', () => {
    mockUseCanViewAuditLogs.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/You do not have permission to view audit logs/)).toBeInTheDocument();
  });

  it('renders loading skeleton rows while the query is loading', () => {
    mockUseAuditLogs.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Loading audit logs')).toBeInTheDocument();
  });

  it('shows the empty state message when no records exist', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse({ results: [], count: 0 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByText('No audit records yet')).toBeInTheDocument();
  });

  it('renders list records and their action labels', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getAllByText('Incident Created').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ana Doe')).toBeInTheDocument();
    expect(screen.getByText('Incident')).toBeInTheDocument();
    expect(screen.getByText(/inc-42/)).toBeInTheDocument();
  });

  it('shows system actor for backend-null actor events', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse({
        results: [{ ...sampleLog, actor: null, action: 'sla.breached' }],
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getAllByText('SLA Breached').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('System-generated event')).toBeInTheDocument();
  });

  it('shows error state with a retry that calls refetch', () => {
    const refetch = vi.fn();
    mockUseAuditLogs.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network failure'),
      refetch,
    });

    renderPage();
    expect(screen.getByText('Network failure')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders pagination footer when data is present', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse({ count: 120, next: 'page2', previous: null }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByLabelText('120 total audit records')).toBeInTheDocument();
  });

  it('renders the detail panel when a record is selected', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    fireEvent.click(screen.getByLabelText('View audit log: Incident Created'));

    expect(screen.getAllByText('Incident Created').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Performed by')).toBeInTheDocument();
    expect(screen.getByText('Record ID')).toBeInTheDocument();
  });

  it('closing the detail panel returns to the placeholder state', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    fireEvent.click(screen.getByLabelText('View audit log: Incident Created'));
    fireEvent.click(screen.getByLabelText('Close audit record details'));

    expect(screen.getByText(/Select an audit record to view its full details/)).toBeInTheDocument();
  });

  it('offers filter inputs and reveals clear filters after input', () => {
    mockUseAuditLogs.mockReturnValue({
      data: sampleResponse(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByLabelText('Filter by action')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by resource type')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by resource type'), {
      target: { value: 'incident' },
    });
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by resource type')).toHaveValue('incident');
  });
});