/**
 * Tests for DashboardIncidentList (shared by the Active, Critical, and
 * Recent panels).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardIncidentList } from '../components/DashboardIncidentList';
import type { DashboardIncident } from '../types/operations.types';

const incidents: DashboardIncident[] = [
  {
    id: 'inc-1',
    incident_number: 'INC-001',
    title: 'Database latency spike',
    status: 'OPEN',
    priority: 'P1',
    assignee_email: 'sre@example.com',
    sla_state: 'BREACHED',
    escalation_status: 'ACTIVE',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'inc-2',
    incident_number: 'INC-002',
    title: 'Slow checkout flow',
    status: 'IN_PROGRESS',
    priority: 'P2',
    assignee_email: null,
    sla_state: 'HEALTHY',
    escalation_status: null,
    created_at: '2024-01-16T10:00:00Z',
  },
];

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('DashboardIncidentList', () => {
  it('renders loading skeleton rows', () => {
    const { container } = wrap(
      <DashboardIncidentList incidents={[]} isLoading error={null} />
    );

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders an error state with retry', () => {
    const onRetry = vi.fn();
    wrap(
      <DashboardIncidentList incidents={[]} isLoading={false} error="boom" onRetry={onRetry} />
    );

    expect(screen.getAllByText('boom').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the default empty state', () => {
    wrap(<DashboardIncidentList incidents={[]} isLoading={false} error={null} />);

    expect(screen.getByText('No incidents to display')).toBeInTheDocument();
  });

  it('renders custom empty copy', () => {
    wrap(
      <DashboardIncidentList
        incidents={[]}
        isLoading={false}
        error={null}
        emptyTitle="No critical incidents"
        emptyDescription="There are no P1 incidents."
      />
    );

    expect(screen.getByText('No critical incidents')).toBeInTheDocument();
    expect(screen.getByText('There are no P1 incidents.')).toBeInTheDocument();
  });

  it('renders incident rows with badges, assignee, and detail links', () => {
    wrap(<DashboardIncidentList incidents={incidents} isLoading={false} error={null} />);

    expect(screen.getByText('INC-001')).toBeInTheDocument();
    expect(screen.getByText('Database latency spike')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Status: Open' })).toBeInTheDocument();
    expect(screen.getByText('sre@example.com')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'View incident INC-001: Database latency spike' })).toHaveAttribute(
      'href',
      '/app/incidents/inc-1'
    );
    expect(screen.getByRole('link', { name: 'View incident INC-002: Slow checkout flow' })).toHaveAttribute(
      'href',
      '/app/incidents/inc-2'
    );
  });

  it('surfaces SLA at-risk/breached state in text (not color alone)', () => {
    wrap(<DashboardIncidentList incidents={incidents} isLoading={false} error={null} />);

    expect(screen.getByText('SLA breached')).toBeInTheDocument();
    // HEALTHY rows must NOT render a sla chip
    expect(screen.queryByText('SLA healthy')).not.toBeInTheDocument();
  });
});