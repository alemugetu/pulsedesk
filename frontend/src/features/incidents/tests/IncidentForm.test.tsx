/**
 * Tests for IncidentForm component
 * 
 * Tests the operational incident form with classification, SLA preview,
 * escalation levels, file attachments, validation, and submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IncidentForm } from '../components/IncidentForm';
import type { Incident, CreateIncidentRequest } from '../types/incident.types';

vi.mock('../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => ({ id: 'org-1', name: 'Test Org' }),
  useOrganizationContext: () => ({
    currentOrganization: { id: 'org-1', name: 'Test Org' },
  }),
}));

vi.mock('../hooks/useIncidentCategories', () => ({
  useIncidentCategories: () => ({
    data: [{ id: 'cat-1', name: 'Infrastructure' }],
    isLoading: false,
  }),
}));

vi.mock('../../organizations/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    data: [
      {
        id: 'mem-1',
        status: 'ACTIVE',
        user: { id: 'u-1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
        role: { id: 'r-1', name: 'Operations Manager' },
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../organizations/hooks/useOrganizationRoles', () => ({
  useOrganizationRoles: () => ({
    data: [{ id: 'r-1', name: 'Operations Manager' }],
    isLoading: false,
  }),
}));

vi.mock('../../sla/hooks/useSlaPolicies', () => ({
  useSlaPolicies: () => ({
    data: [
      {
        id: 'sla-1',
        name: 'Standard SLA',
        is_default: true,
        targets: [
          { priority: 'P1', response_time_minutes: 15, resolution_time_minutes: 120 },
          { priority: 'P2', response_time_minutes: 30, resolution_time_minutes: 240 },
          { priority: 'P3', response_time_minutes: 60, resolution_time_minutes: 480 },
          { priority: 'P4', response_time_minutes: 120, resolution_time_minutes: 1440 },
        ],
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../sla/hooks/useEscalationPolicies', () => ({
  useEscalationPolicies: () => ({
    data: [
      {
        id: 'esc-1',
        name: 'Critical Escalation',
        is_default: true,
        levels: [
          {
            id: 'lvl-1',
            level: 1,
            name: 'Notify Operations Lead',
            delay_minutes: 15,
            target_type: 'ROLE',
            target_reference: 'r-1',
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

describe('IncidentForm', () => {
  let queryClient: QueryClient;

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

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('should render form for creating new incident with operational sections', () => {
    const handleSubmit = vi.fn();

    renderWithProviders(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    expect(screen.getByLabelText(/Incident Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Priority Severity' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Incident Category' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Primary Assignee' })).toBeInTheDocument();
    expect(screen.getByText('Create Incident')).toBeInTheDocument();

    // SLA & Escalation sections
    expect(screen.getByText('Service Level Agreement (SLA) Policy')).toBeInTheDocument();
    expect(screen.getByText('Escalation Policy')).toBeInTheDocument();
    expect(screen.getByText(/Targets for P3 Severity/i)).toBeInTheDocument();
  });

  it('should render form for editing existing incident', () => {
    const handleSubmit = vi.fn();

    renderWithProviders(
      <IncidentForm
        incident={mockIncident}
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Update Incident"
      />
    );

    expect(screen.getByDisplayValue('Existing Incident')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('P2 — High (Significant degradation)')).toBeInTheDocument();
  });

  it('should show validation error for empty title', async () => {
    const handleSubmit = vi.fn();

    const { container } = renderWithProviders(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    // Submit the form directly
    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    expect(handleSubmit).not.toHaveBeenCalled();
    const errorText = await screen.findByText('Incident title is required');
    expect(errorText).toBeInTheDocument();
  });

  it('should call onSubmit with valid data and staged files', () => {
    const handleSubmit = vi.fn();

    renderWithProviders(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    const titleInput = screen.getByLabelText(/Incident Title/i);
    const descriptionInput = screen.getByLabelText('Description');
    const prioritySelect = screen.getByRole('combobox', { name: 'Priority Severity' });
    const submitButton = screen.getByText('Create Incident');

    fireEvent.change(titleInput, { target: { value: 'New Incident' } });
    fireEvent.change(descriptionInput, { target: { value: 'New description' } });
    fireEvent.change(prioritySelect, { target: { value: 'P1' } });
    fireEvent.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledWith(
      {
        title: 'New Incident',
        description: 'New description',
        priority: 'P1',
        category_id: null,
        assignee_id: null,
      } as CreateIncidentRequest,
      []
    );
  });

  it('should call onCancel when cancel button is clicked', () => {
    const handleSubmit = vi.fn();
    const handleCancel = vi.fn();

    renderWithProviders(
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

    renderWithProviders(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={true}
        submitLabel="Create Incident"
      />
    );

    const submitButton = screen.getByText('Create Incident');
    expect(submitButton).toBeDisabled();
  });

  it('should allow staging and removing file attachments', async () => {
    const handleSubmit = vi.fn();
    const { container } = renderWithProviders(
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={false}
        submitLabel="Create Incident"
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['log data content'], 'error.log', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('error.log')).toBeInTheDocument();
      expect(screen.getByText(/Staged for upload/i)).toBeInTheDocument();
    });

    const removeBtn = screen.getByLabelText('Remove file error.log');
    fireEvent.click(removeBtn);

    expect(screen.queryByText('error.log')).not.toBeInTheDocument();
  });
});
