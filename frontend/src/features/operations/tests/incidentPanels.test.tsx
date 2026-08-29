/**
 * Tests for the Active, Critical, and Recent incident panels.
 *
 * Verifies each panel wires the correct backend query: Active uses the merged
 * active-incidents fetch (limit 5); Critical filters to priority P1; Recent
 * has no priority filter. All rows come from the same real dashboard API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActiveIncidentsPanel } from '../components/ActiveIncidentsPanel';
import { CriticalIncidentsPanel } from '../components/CriticalIncidentsPanel';
import { RecentIncidentsPanel } from '../components/RecentIncidentsPanel';
import type { DashboardIncident } from '../types/operations.types';

const {
  mockUseOperationsActiveIncidents,
  mockUseOperationsIncidents,
} = vi.hoisted(() => ({
  mockUseOperationsActiveIncidents: vi.fn(),
  mockUseOperationsIncidents: vi.fn(),
}));

vi.mock('../hooks/useOperationsActiveIncidents', () => ({
  useOperationsActiveIncidents: (limit: number) => mockUseOperationsActiveIncidents(limit),
}));

vi.mock('../hooks/useOperationsIncidents', () => ({
  useOperationsIncidents: (params?: unknown) => mockUseOperationsIncidents(params),
}));

const incident: DashboardIncident = {
  id: 'inc-1',
  incident_number: 'INC-001',
  title: 'Search service down',
  status: 'OPEN',
  priority: 'P1',
  assignee_email: 'sre@example.com',
  sla_state: 'AT_RISK',
  escalation_status: 'ACTIVE',
  created_at: '2024-01-15T10:00:00Z',
};

const listResponse = (results: DashboardIncident[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ActiveIncidentsPanel', () => {
  beforeEach(() => {
    mockUseOperationsActiveIncidents.mockReset();
  });

  it('fetches up to 5 merged active incidents and renders them', () => {
    mockUseOperationsActiveIncidents.mockReturnValue({
      data: [incident],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    wrap(<ActiveIncidentsPanel />);

    expect(mockUseOperationsActiveIncidents).toHaveBeenCalledWith(5);
    expect(screen.getByText('Active Incidents')).toBeInTheDocument();
    expect(screen.getByText('Search service down')).toBeInTheDocument();
  });

  it('renders the empty state when there are no active incidents', () => {
    mockUseOperationsActiveIncidents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    wrap(<ActiveIncidentsPanel />);
    expect(screen.getByText('No active incidents')).toBeInTheDocument();
  });
});

describe('CriticalIncidentsPanel', () => {
  beforeEach(() => {
    mockUseOperationsIncidents.mockReset();
  });

  it('requests backend P1 filter with newest-first ordering and 5 rows', () => {
    mockUseOperationsIncidents.mockReturnValue({
      data: listResponse([incident]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    wrap(<CriticalIncidentsPanel />);

    expect(mockUseOperationsIncidents).toHaveBeenCalledWith({
      priority: 'P1',
      ordering: '-created_at',
      page_size: 5,
    });
    expect(screen.getByText('Critical Incidents')).toBeInTheDocument();
    expect(screen.getByText('Search service down')).toBeInTheDocument();
  });

  it('renders the empty state when there are no P1 incidents', () => {
    mockUseOperationsIncidents.mockReturnValue({
      data: listResponse([]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    wrap(<CriticalIncidentsPanel />);
    expect(screen.getByText('No critical incidents')).toBeInTheDocument();
  });
});

describe('RecentIncidentsPanel', () => {
  beforeEach(() => {
    mockUseOperationsIncidents.mockReset();
  });

  it('requests the newest incidents without a priority filter', () => {
    mockUseOperationsIncidents.mockReturnValue({
      data: listResponse([incident]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    wrap(<RecentIncidentsPanel />);

    expect(mockUseOperationsIncidents).toHaveBeenCalledWith({
      ordering: '-created_at',
      page_size: 5,
    });
    expect(screen.getByText('Recent Incidents')).toBeInTheDocument();
  });
});