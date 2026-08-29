/**
 * Tests for IncidentDetail component
 * 
 * Tests the incident detail component with loading, empty, and error states.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IncidentDetail } from '../components/IncidentDetail';
import type { Incident } from '../types/incident.types';
import { OrganizationContext, type OrganizationContextValue } from '../../organizations/context/organizationContextDef';

/**
 * Wrapper to provide organization and query client context for IncidentDetail tests.
 * IncidentStatusActions requires OrganizationContext and useUpdateIncident requires QueryClient.
 */
function renderWithContext(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const mockContext: OrganizationContextValue = {
    organizations: [],
    currentOrganization: { id: 'org-1', name: 'Test Org', slug: 'test-org' } as never,
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: true,
    selectOrganization: () => {},
    clearCurrentOrganization: () => {},
    createOrganization: async () => ({}) as never,
    refreshOrganizations: async () => {},
    hasPermission: () => true,
    getCurrentRole: () => 'admin',
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizationContext.Provider value={mockContext}>
        {ui}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('IncidentDetail', () => {
  const mockIncident: Incident = {
    id: '1',
    incident_number: 'INC-001',
    title: 'Test Incident',
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
  };

  it('should render loading state', () => {
    renderWithContext(
      <IncidentDetail
        incident={null}
        isLoading={true}
        error={null}
        onStatusChange={() => {}}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render error state', () => {
    renderWithContext(
      <IncidentDetail
        incident={null}
        isLoading={false}
        error="Failed to load incident"
        onStatusChange={() => {}}
      />
    );

    // ErrorState renders the error text in both heading and description
    const matches = screen.getAllByText('Failed to load incident');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should render incident detail', () => {
    renderWithContext(
      <IncidentDetail
        incident={mockIncident}
        isLoading={false}
        error={null}
        onStatusChange={() => {}}
      />
    );

    expect(screen.getByText('INC-001')).toBeInTheDocument();
    expect(screen.getByText('Test Incident')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('P1 — Critical')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should not render content when no incident and not loading', () => {
    renderWithContext(
      <IncidentDetail
        incident={null}
        isLoading={false}
        error={null}
        onStatusChange={() => {}}
      />
    );

    expect(screen.queryByText('INC-001')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Incident')).not.toBeInTheDocument();
  });
});
