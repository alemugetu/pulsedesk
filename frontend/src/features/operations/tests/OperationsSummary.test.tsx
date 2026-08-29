/**
 * Tests for OperationsSummary.
 *
 * Verifies the composed summary: 7 metric cards derived from the real
 * dashboard summary + priority-distribution APIs, combined loading/error
 * handling, and the retry that re-fetches both queries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationsSummary } from '../components/OperationsSummary';

const { mockUseOperationsSummary } = vi.hoisted(() => ({ mockUseOperationsSummary: vi.fn() }));
const { mockUseOperationsPriorityDistribution } = vi.hoisted(() => ({
  mockUseOperationsPriorityDistribution: vi.fn(),
}));

vi.mock('../hooks/useOperationsSummary', () => ({
  useOperationsSummary: () => mockUseOperationsSummary(),
}));

vi.mock('../hooks/useOperationsPriorityDistribution', () => ({
  useOperationsPriorityDistribution: () => mockUseOperationsPriorityDistribution(),
}));

function renderSummary() {
  return render(
    <MemoryRouter>
      <OperationsSummary />
    </MemoryRouter>
  );
}

describe('OperationsSummary', () => {
  beforeEach(() => {
    mockUseOperationsSummary.mockReset();
    mockUseOperationsPriorityDistribution.mockReset();
  });

  it('renders all seven metric cards from real data', () => {
    mockUseOperationsSummary.mockReturnValue({
      data: { open_incidents: 3, unassigned_incidents: 1, sla_at_risk: 2, sla_breached: 1, active_escalations: 4 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseOperationsPriorityDistribution.mockReturnValue({
      data: { low: 5, medium: 4, high: 3, critical: 2 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderSummary();

    expect(screen.getByText('Open Incidents')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Critical Incidents')).toBeInTheDocument();
    expect(screen.getByText('Unassigned Incidents')).toBeInTheDocument();
    expect(screen.getByText('SLA At Risk')).toBeInTheDocument();
    expect(screen.getByText('SLA Breached')).toBeInTheDocument();
    expect(screen.getByText('Active Escalations')).toBeInTheDocument();
    expect(screen.getByText('Total Incidents')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();

    // values that legitimately appear on more than one card
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('links Critical and SLA Breached metrics to the filtered incident list', () => {
    mockUseOperationsSummary.mockReturnValue({
      data: { open_incidents: 0, unassigned_incidents: 0, sla_at_risk: 0, sla_breached: 1, active_escalations: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseOperationsPriorityDistribution.mockReturnValue({
      data: { low: 0, medium: 0, high: 0, critical: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderSummary();

    expect(screen.getByRole('link', { name: 'View critical incidents' })).toHaveAttribute('href', '/app/incidents?priority=P1');
    expect(screen.getByRole('link', { name: 'View sla breached incidents' })).toHaveAttribute('href', '/app/incidents?sla_state=BREACHED');
    fireEvent.click(screen.getByRole('link', { name: 'View critical incidents' }));
  });

  it('renders loading skeletons while either query is loading', () => {
    mockUseOperationsSummary.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    mockUseOperationsPriorityDistribution.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });

    const { container } = renderSummary();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the error state and retries both queries', () => {
    const refetchSummary = vi.fn();
    const refetchDistribution = vi.fn();
    mockUseOperationsSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('summary boom'),
      refetch: refetchSummary,
    });
    mockUseOperationsPriorityDistribution.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: refetchDistribution,
    });

    renderSummary();

    expect(screen.getAllByText('summary boom').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetchSummary).toHaveBeenCalled();
    expect(refetchDistribution).toHaveBeenCalled();
  });
});