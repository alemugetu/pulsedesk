import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CreateIncidentPage } from '../../../pages/app/CreateIncidentPage';
import * as incidentHooks from '../hooks/useCreateIncident';
import * as attachmentService from '../../collaboration/services/attachmentService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockHasPermission = true;
let mockOrganization: { id: string; name: string } | null = { id: 'org-1', name: 'Test Org' };

vi.mock('../../organizations/context/organizationContextDef', () => ({
  useOrganizationContext: () => ({
    currentOrganization: mockOrganization,
    hasPermission: (perm: string) => {
      if (perm === 'incident.create') return mockHasPermission;
      return true;
    },
  }),
  useCurrentOrganization: () => mockOrganization,
}));

vi.mock('../hooks/useIncidentCategories', () => ({
  useIncidentCategories: () => ({
    data: [{ id: 'cat-1', name: 'Database' }],
    isLoading: false,
  }),
}));

vi.mock('../../organizations/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    data: [
      {
        id: 'mem-1',
        status: 'ACTIVE',
        user: { id: 'u-1', email: 'agent@example.com', first_name: 'Jane', last_name: 'Smith' },
        role: { id: 'r-1', name: 'Senior Agent' },
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../organizations/hooks/useOrganizationRoles', () => ({
  useOrganizationRoles: () => ({
    data: [{ id: 'r-1', name: 'Senior Agent' }],
    isLoading: false,
  }),
}));

vi.mock('../../sla/hooks/useSlaPolicies', () => ({
  useSlaPolicies: () => ({
    data: [
      {
        id: 'sla-1',
        name: 'Enterprise SLA',
        is_default: true,
        targets: [
          { priority: 'P1', response_time_minutes: 15, resolution_time_minutes: 60 },
          { priority: 'P2', response_time_minutes: 30, resolution_time_minutes: 120 },
          { priority: 'P3', response_time_minutes: 60, resolution_time_minutes: 240 },
          { priority: 'P4', response_time_minutes: 120, resolution_time_minutes: 480 },
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
        name: 'Standard Escalation',
        is_default: true,
        levels: [
          {
            id: 'lvl-1',
            level: 1,
            name: 'Tier 1 Escalation',
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

describe('IncidentCreationIntegration', () => {
  let queryClient: QueryClient;
  const mockCreateIncidentAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission = true;
    mockOrganization = { id: 'org-1', name: 'Test Org' };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(incidentHooks, 'useCreateIncident').mockReturnValue({
      createIncidentAsync: mockCreateIncidentAsync,
      createIncident: vi.fn(),
      isLoading: false,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
      variables: undefined,
      context: undefined,
    } as never);

    vi.spyOn(attachmentService, 'uploadAttachment').mockResolvedValue({
      id: 'att-1',
      incident: 'inc-999',
      filename: 'error.log',
      file_size: 1024,
      content_type: 'text/plain',
      uploaded_by: { id: 'u-1', email: 'me@example.com' },
      created_at: '2026-01-01T00:00:00Z',
    } as never);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreateIncidentPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders permission denied when user lacks incident.create', () => {
    mockHasPermission = false;
    renderComponent();

    expect(screen.getByText('Permission Denied')).toBeInTheDocument();
    expect(screen.getByText(/You do not have permission to create incidents/i)).toBeInTheDocument();
  });

  it('renders empty organization prompt when no active organization', () => {
    mockOrganization = null;
    renderComponent();

    expect(screen.getByText(/Please select an organization/i)).toBeInTheDocument();
  });

  it('renders operational incident creation workflow for authorized user', () => {
    renderComponent();

    expect(screen.getByText('Report New Incident')).toBeInTheDocument();
    expect(screen.getByLabelText(/Incident Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Incident Attachments')).toBeInTheDocument();
  });

  it('executes coordinated workflow: creates incident, uploads attachment, navigates to detail', async () => {
    mockCreateIncidentAsync.mockResolvedValue({
      id: 'inc-999',
      incident_number: 'INC-000999',
      title: 'Database connection timeout',
    });

    const { container } = renderComponent();

    // Fill form
    const titleInput = screen.getByLabelText(/Incident Title/i);
    fireEvent.change(titleInput, { target: { value: 'Database connection timeout' } });

    // Stage a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['log data'], 'db_error.log', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('db_error.log')).toBeInTheDocument();
    });

    // Submit
    const submitBtn = screen.getByText('Create Incident');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateIncidentAsync).toHaveBeenCalledWith({
        title: 'Database connection timeout',
        description: '',
        priority: 'P3',
        category_id: null,
        assignee_id: null,
      });
      expect(attachmentService.uploadAttachment).toHaveBeenCalledWith(
        'org-1',
        'inc-999',
        testFile
      );
      expect(mockNavigate).toHaveBeenCalledWith('/app/incidents/inc-999');
    });
  });

  it('displays error alert when incident creation fails', async () => {
    mockCreateIncidentAsync.mockRejectedValue(new Error('Network error creating incident'));

    renderComponent();

    const titleInput = screen.getByLabelText(/Incident Title/i);
    fireEvent.change(titleInput, { target: { value: 'Failed incident' } });

    const submitBtn = screen.getByText('Create Incident');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Unable to submit incident')).toBeInTheDocument();
      expect(screen.getByText('Network error creating incident')).toBeInTheDocument();
    });
  });
});
