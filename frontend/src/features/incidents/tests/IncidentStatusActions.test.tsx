/**
 * Tests for IncidentStatusActions component
 * 
 * Tests the incident status transition actions, permission gating, and acknowledgement flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentStatusActions } from '../components/IncidentStatusActions';
import type { Incident } from '../types/incident.types';

const mockUpdateIncidentAsync = vi.fn();
let mockPermissions = ['incident.update', 'incident.resolve', 'incident.close'];

vi.mock('../hooks/useUpdateIncident', () => ({
  useUpdateIncident: () => ({
    updateIncidentAsync: mockUpdateIncidentAsync,
    isLoading: false,
  }),
}));

vi.mock('../../organizations/context/organizationContextDef', () => ({
  useOrganizationContext: () => ({
    hasPermission: (perm: string) => mockPermissions.includes(perm),
  }),
}));

describe('IncidentStatusActions', () => {
  const baseIncident: Incident = {
    id: 'inc-1',
    incident_number: 'INC-000001',
    title: 'Test Incident',
    status: 'OPEN',
    priority: 'P1',
    description: 'Test description',
    category: null,
    reporter: { id: 'user1', email: 'reporter@example.com' },
    assignee: null,
    sla: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    resolved_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = ['incident.update', 'incident.resolve', 'incident.close'];
  });

  it('should render Acknowledge transition when incident is OPEN', () => {
    const handleStatusChange = vi.fn();

    render(
      <IncidentStatusActions
        incident={baseIncident}
        onStatusChange={handleStatusChange}
      />
    );

    // OPEN only transitions to ACKNOWLEDGED in backend ALLOWED_TRANSITIONS
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });

  it('should render In Progress transition when incident is ACKNOWLEDGED', () => {
    const ackIncident: Incident = {
      ...baseIncident,
      status: 'ACKNOWLEDGED',
    };

    render(<IncidentStatusActions incident={ackIncident} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('should render Resolved transition when incident is IN_PROGRESS', () => {
    const inProgressIncident: Incident = {
      ...baseIncident,
      status: 'IN_PROGRESS',
    };

    render(<IncidentStatusActions incident={inProgressIncident} />);

    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('should not render transition when user lacks required permission', () => {
    mockPermissions = ['incident.update']; // lacks incident.resolve

    const inProgressIncident: Incident = {
      ...baseIncident,
      status: 'IN_PROGRESS',
    };

    render(<IncidentStatusActions incident={inProgressIncident} />);

    // Cannot transition to RESOLVED without incident.resolve
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
    expect(screen.getByText(/You do not have permission/i)).toBeInTheDocument();
  });

  it('should not render when incident is in terminal CLOSED state', () => {
    const closedIncident: Incident = {
      ...baseIncident,
      status: 'CLOSED',
    };

    const { container } = render(
      <IncidentStatusActions incident={closedIncident} />
    );

    // CLOSED status has no valid transitions, renders null
    expect(container.firstChild).toBeNull();
  });

  it('should handle status transition execution', async () => {
    const handleStatusChange = vi.fn();
    mockUpdateIncidentAsync.mockResolvedValue({});

    render(
      <IncidentStatusActions
        incident={baseIncident}
        onStatusChange={handleStatusChange}
      />
    );

    const acknowledgeButton = screen.getByText('Acknowledged');
    fireEvent.click(acknowledgeButton);

    expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
      incidentId: 'inc-1',
      data: { status: 'ACKNOWLEDGED' },
    });
  });

  it('should require confirmation before resolving an incident', async () => {
    const inProgressIncident: Incident = {
      ...baseIncident,
      status: 'IN_PROGRESS',
    };

    render(<IncidentStatusActions incident={inProgressIncident} />);

    const resolveBtn = screen.getByText('Resolved');
    fireEvent.click(resolveBtn);

    // Confirmation dialog should appear
    expect(screen.getByText('Confirm transition to Resolved?')).toBeInTheDocument();
    const confirmBtn = screen.getByText('Confirm Resolved');
    fireEvent.click(confirmBtn);

    expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
      incidentId: 'inc-1',
      data: { status: 'RESOLVED' },
    });
  });
});
