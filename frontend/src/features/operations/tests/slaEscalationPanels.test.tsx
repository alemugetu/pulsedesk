/**
 * Tests for SlaOverviewPanel and EscalationOverviewPanel.
 *
 * Verifies the read-only overview panels render backend-derived counts only,
 * surface loading/error/empty states, and never fabricate SLA percentages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlaOverviewPanel } from '../components/SlaOverviewPanel';
import { EscalationOverviewPanel } from '../components/EscalationOverviewPanel';

const { mockUseOperationsSla } = vi.hoisted(() => ({ mockUseOperationsSla: vi.fn() }));
const { mockUseOperationsEscalations } = vi.hoisted(() => ({
  mockUseOperationsEscalations: vi.fn(),
}));

vi.mock('../hooks/useOperationsSla', () => ({
  useOperationsSla: () => mockUseOperationsSla(),
}));

vi.mock('../hooks/useOperationsEscalations', () => ({
  useOperationsEscalations: () => mockUseOperationsEscalations(),
}));

describe('SlaOverviewPanel', () => {
  beforeEach(() => {
    mockUseOperationsSla.mockReset();
  });

  it('renders loading skeleton tiles', () => {
    mockUseOperationsSla.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });

    const { container } = render(<SlaOverviewPanel />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders an error state with retry', () => {
    const refetch = vi.fn();
    mockUseOperationsSla.mockReturnValue({ data: undefined, isLoading: false, error: new Error('sla boom'), refetch });

    render(<SlaOverviewPanel />);
    expect(screen.getAllByText('sla boom').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders an empty state when every SLA count is zero', () => {
    mockUseOperationsSla.mockReturnValue({
      data: {
        healthy: 0,
        approaching: 0,
        breached: 0,
        resolved_within_sla: 0,
        response_breaches: 0,
        resolution_breaches: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SlaOverviewPanel />);
    expect(screen.getByText('No SLA data')).toBeInTheDocument();
  });

  it('renders real counts and the breach breakdown without fabrication', () => {
    mockUseOperationsSla.mockReturnValue({
      data: {
        healthy: 5,
        approaching: 2,
        breached: 1,
        resolved_within_sla: 4,
        response_breaches: 1,
        resolution_breaches: 2,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SlaOverviewPanel />);

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Approaching')).toBeInTheDocument();
    expect(screen.getByText('Breached')).toBeInTheDocument();
    expect(screen.getByText('Resolved within SLA')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Breach breakdown')).toBeInTheDocument();
    expect(screen.getByText('Response breaches')).toBeInTheDocument();
    expect(screen.getByText('Resolution breaches')).toBeInTheDocument();
  });

  it('does not render fabricated percentage values', () => {
    mockUseOperationsSla.mockReturnValue({
      data: {
        healthy: 5,
        approaching: 2,
        breached: 1,
        resolved_within_sla: 4,
        response_breaches: 1,
        resolution_breaches: 2,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SlaOverviewPanel />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

describe('EscalationOverviewPanel', () => {
  beforeEach(() => {
    mockUseOperationsEscalations.mockReset();
  });

  it('renders an error state with retry', () => {
    const refetch = vi.fn();
    mockUseOperationsEscalations.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('esc boom'),
      refetch,
    });

    render(<EscalationOverviewPanel />);
    expect(screen.getAllByText('esc boom').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders an empty state when there is no escalation activity', () => {
    mockUseOperationsEscalations.mockReturnValue({
      data: { active: 0, completed: 0, cancelled: 0, by_level: {} },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<EscalationOverviewPanel />);
    expect(screen.getByText('No escalation activity')).toBeInTheDocument();
  });

  it('renders counts and by-level chips sorted by level', () => {
    mockUseOperationsEscalations.mockReturnValue({
      data: { active: 2, completed: 3, cancelled: 1, by_level: { '2': 1, '1': 2, '3': 0 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<EscalationOverviewPanel />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('Active escalations by level')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('hides the by-level section when the backend returns no levels', () => {
    mockUseOperationsEscalations.mockReturnValue({
      data: { active: 2, completed: 0, cancelled: 0, by_level: {} },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<EscalationOverviewPanel />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Active escalations by level')).not.toBeInTheDocument();
  });
});