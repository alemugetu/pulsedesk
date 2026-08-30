/**
 * Tests for ReportsPage.
 *
 * Verifies permission gating, loading states, empty states, error/retry,
 * and successful rendering of report sections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsPage } from '../../../pages/app/ReportsPage';

const mockUseCanViewReports = vi.fn();
const mockUseIncidentSummary = vi.fn();
const mockUseIncidentsByStatus = vi.fn();
const mockUseIncidentsByPriority = vi.fn();
const mockUseIncidentsByCategory = vi.fn();
const mockUseIncidentTrend = vi.fn();
const mockUseSLAPerformance = vi.fn();
const mockUseAverageResolutionTime = vi.fn();
const mockUseEscalationActivity = vi.fn();
const mockGetDefaultDateRange = vi.fn();

vi.mock('../hooks/useReports', () => ({
  useCanViewReports: () => mockUseCanViewReports(),
}));

vi.mock('../hooks/useIncidentReports', () => ({
  useIncidentSummary: () => mockUseIncidentSummary(),
  useIncidentsByStatus: () => mockUseIncidentsByStatus(),
  useIncidentsByPriority: () => mockUseIncidentsByPriority(),
  useIncidentsByCategory: () => mockUseIncidentsByCategory(),
  useIncidentTrend: () => mockUseIncidentTrend(),
}));

vi.mock('../hooks/useSLAReports', () => ({
  useSLAPerformance: () => mockUseSLAPerformance(),
  useAverageResolutionTime: () => mockUseAverageResolutionTime(),
}));

vi.mock('../hooks/useEscalationReports', () => ({
  useEscalationActivity: () => mockUseEscalationActivity(),
}));

vi.mock('../utils/reportUtils', () => ({
  getDefaultDateRange: () => mockGetDefaultDateRange(),
  formatDateForInput: (v: string) => v,
  formatDateForApi: (v: string) => v,
}));

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
  mockUseCanViewReports.mockReturnValue(true);
  mockGetDefaultDateRange.mockReturnValue({
    start: '2026-01-01T00:00',
    end: '2026-01-31T23:59',
  });
  mockUseIncidentSummary.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseIncidentsByStatus.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseIncidentsByPriority.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseIncidentsByCategory.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseIncidentTrend.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseSLAPerformance.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseAverageResolutionTime.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  mockUseEscalationActivity.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
});

function renderPage() {
  return render(<ReportsPage />, { wrapper: createWrapper() });
}

describe('ReportsPage', () => {
  it('renders the reports page header', () => {
    renderPage();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Operational analytics and insights for your organization.')).toBeInTheDocument();
  });

  it('shows access restricted when user lacks permission', () => {
    mockUseCanViewReports.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/You do not have permission to view reports/)).toBeInTheDocument();
  });

  it('renders loading skeletons when all queries are loading', () => {
    mockUseIncidentSummary.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseIncidentsByStatus.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseIncidentsByPriority.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseIncidentsByCategory.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseIncidentTrend.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseSLAPerformance.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseAverageResolutionTime.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseEscalationActivity.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });

    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders report sections with successful data', () => {
    mockUseIncidentSummary.mockReturnValue({
      data: { total_incidents: 10, open_incidents: 3, resolved_incidents: 5, closed_incidents: 2, unassigned_incidents: 1, critical_incidents: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseIncidentsByStatus.mockReturnValue({
      data: { OPEN: 5, ACKNOWLEDGED: 2, IN_PROGRESS: 1, RESOLVED: 3, CLOSED: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseIncidentsByPriority.mockReturnValue({
      data: { P1: 1, P2: 2, P3: 4, P4: 3 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseIncidentsByCategory.mockReturnValue({
      data: { categories: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseIncidentTrend.mockReturnValue({
      data: { granularity: 'daily', data: [{ date: '2026-01-01', count: 2 }] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseSLAPerformance.mockReturnValue({
      data: { total_sla_incidents: 10, compliant_incidents: 8, breached_incidents: 2, completed_sla_records: 9, compliance_percentage: 80.0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseAverageResolutionTime.mockReturnValue({
      data: { average_resolution_seconds: 3600, resolved_incident_count: 5 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseEscalationActivity.mockReturnValue({
      data: { total_escalation_events: 4, by_level: { '1': 2, '2': 2 }, by_trigger_type: { SLA_BREACH: 3, MANUAL: 1 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Incidents')).toBeInTheDocument();
    expect(screen.getAllByText('Incident Trend').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SLA Performance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Escalation Activity').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no data is available', () => {
    mockUseIncidentSummary.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentsByStatus.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentsByPriority.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentsByCategory.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentTrend.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseSLAPerformance.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseAverageResolutionTime.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseEscalationActivity.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });

    renderPage();
    expect(screen.getByText('No report data')).toBeInTheDocument();
  });

  it('shows error banner and retry button when queries fail', () => {
    const error = new Error('Network failure');
    mockUseIncidentSummary.mockReturnValue({ data: undefined, isLoading: false, error, refetch: vi.fn() });
    mockUseIncidentsByStatus.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentsByPriority.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentsByCategory.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseIncidentTrend.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseSLAPerformance.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseAverageResolutionTime.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    mockUseEscalationActivity.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });

    renderPage();
    expect(screen.getByText('Network failure')).toBeInTheDocument();
    expect(screen.getByText('Retry All')).toBeInTheDocument();
  });

  it('calls refetch on all queries when Retry All is clicked', () => {
    const refetchSummary = vi.fn();
    const refetchStatus = vi.fn();
    const refetchPriority = vi.fn();
    const refetchCategory = vi.fn();
    const refetchTrend = vi.fn();
    const refetchSla = vi.fn();
    const refetchResolution = vi.fn();
    const refetchEscalation = vi.fn();

    mockUseIncidentSummary.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail'), refetch: refetchSummary });
    mockUseIncidentsByStatus.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchStatus });
    mockUseIncidentsByPriority.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchPriority });
    mockUseIncidentsByCategory.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchCategory });
    mockUseIncidentTrend.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchTrend });
    mockUseSLAPerformance.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchSla });
    mockUseAverageResolutionTime.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchResolution });
    mockUseEscalationActivity.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchEscalation });

    renderPage();
    fireEvent.click(screen.getByText('Retry All'));
    expect(refetchSummary).toHaveBeenCalled();
    expect(refetchStatus).toHaveBeenCalled();
    expect(refetchPriority).toHaveBeenCalled();
    expect(refetchCategory).toHaveBeenCalled();
    expect(refetchTrend).toHaveBeenCalled();
    expect(refetchSla).toHaveBeenCalled();
    expect(refetchResolution).toHaveBeenCalled();
    expect(refetchEscalation).toHaveBeenCalled();
  });

  it('renders date range and granularity filters', () => {
    renderPage();
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('End')).toBeInTheDocument();
    expect(screen.getByLabelText('Granularity')).toBeInTheDocument();
  });
});

