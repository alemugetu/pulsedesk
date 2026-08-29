/**
 * Tests for IncidentStatusChart and IncidentPriorityChart.
 *
 * Verifies the accessible bar charts render backend-derived counts with text
 * labels (no color-only semantics), plus loading/error/empty states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentStatusChart } from '../components/IncidentStatusChart';
import { IncidentPriorityChart } from '../components/IncidentPriorityChart';

const { mockUseOperationsStatusDistribution } = vi.hoisted(() => ({
  mockUseOperationsStatusDistribution: vi.fn(),
}));
const { mockUseOperationsPriorityDistribution } = vi.hoisted(() => ({
  mockUseOperationsPriorityDistribution: vi.fn(),
}));

vi.mock('../hooks/useOperationsStatusDistribution', () => ({
  useOperationsStatusDistribution: () => mockUseOperationsStatusDistribution(),
}));

vi.mock('../hooks/useOperationsPriorityDistribution', () => ({
  useOperationsPriorityDistribution: () => mockUseOperationsPriorityDistribution(),
}));

describe('IncidentStatusChart', () => {
  beforeEach(() => {
    mockUseOperationsStatusDistribution.mockReset();
  });

  it('renders a loading indicator', () => {
    mockUseOperationsStatusDistribution.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<IncidentStatusChart />);
    expect(screen.getByText('Loading status distribution...')).toBeInTheDocument();
  });

  it('renders an error state with retry', () => {
    const refetch = vi.fn();
    mockUseOperationsStatusDistribution.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('status boom'),
      refetch,
    });

    render(<IncidentStatusChart />);
    expect(screen.getAllByText('status boom').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders an empty state when all statuses are zero', () => {
    mockUseOperationsStatusDistribution.mockReturnValue({
      data: { OPEN: 0, ACKNOWLEDGED: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IncidentStatusChart />);
    expect(screen.getByText('No incident status data')).toBeInTheDocument();
  });

  it('renders per-status labels and real counts with a text-based aria summary', () => {
    mockUseOperationsStatusDistribution.mockReturnValue({
      data: { OPEN: 3, ACKNOWLEDGED: 0, IN_PROGRESS: 2, RESOLVED: 5, CLOSED: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IncidentStatusChart />);

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();

    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute(
      'aria-label',
      'Incident status distribution: Open: 3, Acknowledged: 0, In Progress: 2, Resolved: 5, Closed: 1'
    );
  });
});

describe('IncidentPriorityChart', () => {
  beforeEach(() => {
    mockUseOperationsPriorityDistribution.mockReset();
  });

  it('renders an empty state when all priorities are zero', () => {
    mockUseOperationsPriorityDistribution.mockReturnValue({
      data: { low: 0, medium: 0, high: 0, critical: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IncidentPriorityChart />);
    expect(screen.getByText('No priority data')).toBeInTheDocument();
  });

  it('renders priority labels and counts sourced from the backend endpoint', () => {
    mockUseOperationsPriorityDistribution.mockReturnValue({
      data: { low: 4, medium: 3, high: 2, critical: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<IncidentPriorityChart />);

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();

    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute(
      'aria-label',
      'Incident priority distribution: Critical: 1, High: 2, Medium: 3, Low: 4'
    );
  });
});