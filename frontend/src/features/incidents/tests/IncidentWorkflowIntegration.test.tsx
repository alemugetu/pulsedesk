/**
 * IncidentWorkflowIntegration.test.tsx
 *
 * Comprehensive integration tests for Incident Workflow and Assignment:
 * - Full status lifecycle (OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> CLOSED)
 * - Confirmation dialogs for RESOLVED and CLOSED transitions
 * - Terminal state verification (CLOSED has no outgoing transitions)
 * - RBAC permission gating for each transition step
 * - Assignment & Reassignment modal interactions, search, and submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncidentStatusActions } from '../components/IncidentStatusActions';
import { IncidentAssignee } from '../components/IncidentAssignee';
import { IncidentAssigneeModal } from '../components/IncidentAssigneeModal';
import type { Incident } from '../types/incident.types';
import type { Membership } from '../../organizations/types/membership';

const mockUpdateIncidentAsync = vi.fn();
let mockPermissions = ['incident.view', 'incident.update', 'incident.assign', 'incident.resolve', 'incident.close'];

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
  useOptionalOrganizationContext: () => ({
    hasPermission: (perm: string) => mockPermissions.includes(perm),
  }),
  useCurrentOrganization: () => ({
    id: 'org-test-123',
    name: 'Acme Operations',
    slug: 'acme-ops',
  }),
}));

const mockMembers: Membership[] = [
  {
    id: 'mem-1',
    user: {
      id: 'usr-1',
      email: 'alex.engineer@acme.com',
      first_name: 'Alex',
      last_name: 'Smith',
    },
    role: { id: 'role-1', name: 'Senior Engineer', slug: 'senior-engineer' },
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mem-2',
    user: {
      id: 'usr-2',
      email: 'sarah.lead@acme.com',
      first_name: 'Sarah',
      last_name: 'Connor',
    },
    role: { id: 'role-2', name: 'Tech Lead', slug: 'tech-lead' },
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mem-3',
    user: {
      id: 'usr-3',
      email: 'inactive@acme.com',
      first_name: 'Former',
      last_name: 'Employee',
    },
    role: { id: 'role-3', name: 'Engineer', slug: 'engineer' },
    status: 'SUSPENDED',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

vi.mock('../../organizations/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    data: mockMembers,
    isLoading: false,
    error: null,
  }),
}));

describe('Incident Workflow Integration', () => {
  const baseIncident: Incident = {
    id: 'inc-999',
    incident_number: 'INC-000999',
    title: 'Payment Gateway Timeout',
    status: 'OPEN',
    priority: 'P1',
    description: 'High latency and timeout errors connecting to payment backend.',
    category: null,
    reporter: { id: 'user-1', email: 'dispatcher@acme.com' },
    assignee: null,
    sla: null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    resolved_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = ['incident.view', 'incident.update', 'incident.assign', 'incident.resolve', 'incident.close'];
  });

  describe('Status Workflow & RBAC', () => {
    it('allows transitioning from OPEN to ACKNOWLEDGED with incident.update permission', async () => {
      mockUpdateIncidentAsync.mockResolvedValueOnce({});
      const onStatusChange = vi.fn();

      render(<IncidentStatusActions incident={baseIncident} onStatusChange={onStatusChange} />);

      const ackButton = screen.getByRole('button', { name: /change status to acknowledged/i });
      expect(ackButton).toBeInTheDocument();

      fireEvent.click(ackButton);

      expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
        incidentId: 'inc-999',
        data: { status: 'ACKNOWLEDGED' },
      });
    });

    it('requires confirmation before marking an incident as RESOLVED', async () => {
      mockUpdateIncidentAsync.mockResolvedValueOnce({});
      const inProgressIncident: Incident = {
        ...baseIncident,
        status: 'IN_PROGRESS',
      };

      render(<IncidentStatusActions incident={inProgressIncident} />);

      const resolveButton = screen.getByRole('button', { name: /change status to resolved/i });
      fireEvent.click(resolveButton);

      // Confirm dialog appears
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/Confirm transition to Resolved/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm resolved/i });
      fireEvent.click(confirmButton);

      expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
        incidentId: 'inc-999',
        data: { status: 'RESOLVED' },
      });
    });

    it('requires confirmation before marking a RESOLVED incident as CLOSED', async () => {
      mockUpdateIncidentAsync.mockResolvedValueOnce({});
      const resolvedIncident: Incident = {
        ...baseIncident,
        status: 'RESOLVED',
        resolved_at: '2026-01-01T12:00:00Z',
      };

      render(<IncidentStatusActions incident={resolvedIncident} />);

      const closeButton = screen.getByRole('button', { name: /change status to closed/i });
      fireEvent.click(closeButton);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/Confirm transition to Closed/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm closed/i });
      fireEvent.click(confirmButton);

      expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
        incidentId: 'inc-999',
        data: { status: 'CLOSED' },
      });
    });

    it('renders null in CLOSED terminal state with no outgoing transitions', () => {
      const closedIncident: Incident = {
        ...baseIncident,
        status: 'CLOSED',
      };

      const { container } = render(<IncidentStatusActions incident={closedIncident} />);
      expect(container.firstChild).toBeNull();
    });

    it('blocks actions when user lacks incident.resolve permission', () => {
      mockPermissions = ['incident.update']; // Missing incident.resolve
      const inProgressIncident: Incident = {
        ...baseIncident,
        status: 'IN_PROGRESS',
      };

      render(<IncidentStatusActions incident={inProgressIncident} />);

      expect(screen.queryByRole('button', { name: /resolved/i })).not.toBeInTheDocument();
      expect(screen.getByText(/You do not have permission to transition/i)).toBeInTheDocument();
    });

    it('blocks actions when user lacks incident.close permission on resolved incident', () => {
      mockPermissions = ['incident.update', 'incident.resolve']; // Missing incident.close
      const resolvedIncident: Incident = {
        ...baseIncident,
        status: 'RESOLVED',
      };

      render(<IncidentStatusActions incident={resolvedIncident} />);

      expect(screen.queryByRole('button', { name: /closed/i })).not.toBeInTheDocument();
      expect(screen.getByText(/You do not have permission to transition/i)).toBeInTheDocument();
    });
  });

  describe('Assignment & Reassignment Controls', () => {
    it('renders Assign button when incident is unassigned and user has incident.assign', () => {
      render(<IncidentAssignee assignee={null} incidentId="inc-999" />);

      expect(screen.getByText(/Unassigned/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /assign incident to member/i })).toBeInTheDocument();
    });

    it('renders Reassign button when incident is assigned and user has incident.assign', () => {
      const assigneeRef = {
        id: 'mem-1',
        user: { id: 'usr-1', email: 'alex.engineer@acme.com' },
      };

      render(<IncidentAssignee assignee={assigneeRef} incidentId="inc-999" />);

      expect(screen.getByText('alex.engineer@acme.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reassign incident to another member/i })).toBeInTheDocument();
    });

    it('hides Reassign button when user lacks incident.assign permission', () => {
      mockPermissions = ['incident.view']; // Lacks incident.assign
      const assigneeRef = {
        id: 'mem-1',
        user: { id: 'usr-1', email: 'alex.engineer@acme.com' },
      };

      render(<IncidentAssignee assignee={assigneeRef} incidentId="inc-999" />);

      expect(screen.getByText('alex.engineer@acme.com')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reassign/i })).not.toBeInTheDocument();
    });

    it('hides Reassign button when incident is CLOSED', () => {
      const assigneeRef = {
        id: 'mem-1',
        user: { id: 'usr-1', email: 'alex.engineer@acme.com' },
      };

      render(<IncidentAssignee assignee={assigneeRef} incidentId="inc-999" isClosed={true} />);

      expect(screen.queryByRole('button', { name: /reassign/i })).not.toBeInTheDocument();
    });

    it('opens AssigneeModal, filters members, and executes assignment mutation', async () => {
      mockUpdateIncidentAsync.mockResolvedValueOnce({});
      const onAssigned = vi.fn();

      render(
        <IncidentAssigneeModal
          isOpen={true}
          onClose={() => {}}
          incidentId="inc-999"
          currentAssigneeId={null}
          onAssigned={onAssigned}
        />
      );

      // Verify active members are rendered (Alex and Sarah, but not suspended Employee)
      expect(screen.getByText('Alex Smith')).toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
      expect(screen.queryByText('Former Employee')).not.toBeInTheDocument();

      // Search filter
      const searchInput = screen.getByLabelText(/filter organization members/i);
      fireEvent.change(searchInput, { target: { value: 'Sarah' } });

      expect(screen.queryByText('Alex Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();

      // Select Sarah Connor
      const sarahButton = screen.getByRole('button', { name: /sarah connor/i });
      fireEvent.click(sarahButton);

      // Submit assignment
      const confirmButton = screen.getByRole('button', { name: /confirm assignment/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
          incidentId: 'inc-999',
          data: { assignee_id: 'mem-2' },
        });
        expect(onAssigned).toHaveBeenCalledWith('mem-2');
      });
    });

    it('allows returning an incident to the triage pool (unassigning)', async () => {
      mockUpdateIncidentAsync.mockResolvedValueOnce({});
      const onAssigned = vi.fn();

      render(
        <IncidentAssigneeModal
          isOpen={true}
          onClose={() => {}}
          incidentId="inc-999"
          currentAssigneeId="mem-1"
          onAssigned={onAssigned}
        />
      );

      // Click Unassigned option
      const unassignButton = screen.getByRole('button', { name: /unassigned \(triage pool\)/i });
      fireEvent.click(unassignButton);

      const confirmButton = screen.getByRole('button', { name: /confirm assignment/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateIncidentAsync).toHaveBeenCalledWith({
          incidentId: 'inc-999',
          data: { assignee_id: null },
        });
        expect(onAssigned).toHaveBeenCalledWith(null);
      });
    });
  });
});
