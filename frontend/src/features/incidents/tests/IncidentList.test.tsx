/**
 * Tests for IncidentList component
 * 
 * Tests the incident list component with loading, empty, and error states.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentList } from '../components/IncidentList';
import type { Incident } from '../types/incident.types';

describe('IncidentList', () => {
  const mockIncidents: Incident[] = [
    {
      id: '1',
      incident_number: 'INC-001',
      title: 'Test Incident 1',
      status: 'OPEN',
      priority: 'P1',
      description: 'Test description',
      category: null,
      reporter: { id: 'user1', email: 'test@example.com' },
      assignee: null,
      sla: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      resolved_at: null,
    },
    {
      id: '2',
      incident_number: 'INC-002',
      title: 'Test Incident 2',
      status: 'RESOLVED',
      priority: 'P2',
      description: 'Test description 2',
      category: null,
      reporter: { id: 'user2', email: 'test2@example.com' },
      assignee: null,
      sla: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      resolved_at: null,
    },
  ];

  it('should render loading state', () => {
    render(
      <IncidentList
        incidents={[]}
        isLoading={true}
        error={null}
        onIncidentClick={() => {}}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render error state', () => {
    render(
      <IncidentList
        incidents={[]}
        isLoading={false}
        error="Failed to load incidents"
        onIncidentClick={() => {}}
      />
    );

    // ErrorState renders the error text in both heading and description
    const matches = screen.getAllByText('Failed to load incidents');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should render empty state', () => {
    render(
      <IncidentList
        incidents={[]}
        isLoading={false}
        error={null}
        onIncidentClick={() => {}}
      />
    );

    expect(screen.getByText('No incidents found')).toBeInTheDocument();
  });

  it('should render incident list', () => {
    const handleClick = vi.fn();

    render(
      <IncidentList
        incidents={mockIncidents}
        isLoading={false}
        error={null}
        onIncidentClick={handleClick}
      />
    );

    expect(screen.getByText('Test Incident 1')).toBeInTheDocument();
    expect(screen.getByText('Test Incident 2')).toBeInTheDocument();
    expect(screen.getByText('INC-001')).toBeInTheDocument();
    expect(screen.getByText('INC-002')).toBeInTheDocument();
  });

  it('should call onIncidentClick when incident is clicked', () => {
    const handleClick = vi.fn();

    render(
      <IncidentList
        incidents={mockIncidents}
        isLoading={false}
        error={null}
        onIncidentClick={handleClick}
      />
    );

    const firstIncident = screen.getByText('Test Incident 1').closest('button');
    firstIncident?.click();

    expect(handleClick).toHaveBeenCalledWith(mockIncidents[0]);
  });
});
