/**
 * Tests for IncidentForm component
 * 
 * Tests the incident form with validation and submission.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentForm } from '../components/IncidentForm';
import type { Incident, CreateIncidentRequest } from '../types/incident.types';

vi.mock('../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => ({ id: 'org-1', name: 'Test Org' }),
  useOrganizationContext: () => ({
    currentOrganization: { id: 'org-1', name: 'Test Org' },
  }),
}));

vi.mock('../hooks/useIncidentCategories', () => ({
  useIncidentCategories: () => ({ data: [], isLoading: false }),
}));

vi.mock('../../organizations/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({ data: [], isLoading: false }),
}));

describe('IncidentForm', () => {
  const mockIncident: Incident = {
    id: '1',
    incident_number: 'INC-001',
    title: 'Existing Incident',
    status: 'OPEN',
    priority: 'P2',
    description: 'Existing description',
    category: null,
    reporter: { id: 'user1', email: 'test@example.com' },
    assignee: null,
    sla: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    resolved_at: null,
  };

  it('should render form for creating new incident', () => {
    const handleSubmit = vi.fn();

    render(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Priority' })).toBeInTheDocument();
    expect(screen.getByText('Create Incident')).toBeInTheDocument();
  });

  it('should render form for editing existing incident', () => {
    const handleSubmit = vi.fn();

    render(
      <IncidentForm
        incident={mockIncident}
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Update Incident"
      />
    );

    expect(screen.getByDisplayValue('Existing Incident')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    // Select display value is the option text, not the value
    expect(screen.getByDisplayValue('P2 — High')).toBeInTheDocument();
  });

  it('should show validation error for empty title', async () => {
    const handleSubmit = vi.fn();

    const { container } = render(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    // Submit the form directly (fireEvent.click doesn't trigger form submission in React 19/jsdom)
    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    // Validation should prevent submission
    expect(handleSubmit).not.toHaveBeenCalled();
    // Use findByText to wait for the error to appear
    const errorText = await screen.findByText('Incident title is required');
    expect(errorText).toBeInTheDocument();
  });

  it('should call onSubmit with valid data', () => {
    const handleSubmit = vi.fn();

    render(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    const titleInput = screen.getByLabelText(/Title/i);
    const descriptionInput = screen.getByLabelText('Description');
    const prioritySelect = screen.getByRole('combobox', { name: 'Priority' });
    const submitButton = screen.getByText('Create Incident');

    fireEvent.change(titleInput, { target: { value: 'New Incident' } });
    fireEvent.change(descriptionInput, { target: { value: 'New description' } });
    fireEvent.change(prioritySelect, { target: { value: 'P1' } });
    fireEvent.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledWith({
      title: 'New Incident',
      description: 'New description',
      priority: 'P1',
      category_id: null,
      assignee_id: null,
    } as CreateIncidentRequest);
  });

  it('should call onCancel when cancel button is clicked', () => {
    const handleSubmit = vi.fn();
    const handleCancel = vi.fn();

    render(
      <IncidentForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(handleCancel).toHaveBeenCalled();
  });

  it('should disable submit button when loading', () => {
    const handleSubmit = vi.fn();

    render(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={true}
        submitLabel="Create Incident"
      />
    );

    const submitButton = screen.getByText('Create Incident');
    expect(submitButton).toBeDisabled();
  });
});
