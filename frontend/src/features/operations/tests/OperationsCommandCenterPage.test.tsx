/**
 * Tests for OperationsCommandCenterPage.
 *
 * Covers the page-level gate logic and full composition against mocked
 * service data:
 * - No organization selected -> guidance, no sections rendered.
 * - Missing incident.view permission -> permission notice, no sections
 *   rendered (so no dashboard queries fire).
 * - Authorized -> all operational sections compose and render real data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import { OperationsCommandCenterPage } from '../pages/OperationsCommandCenterPage';

const {
  mockGetSummary,
  mockGetPriorityDistribution,
  mockGetSlaMetrics,
  mockGetEscalationMetrics,
  mockGetDashboardIncidents,
  mockGetOperationsActiveIncidents,
  mockGetIncidentStatusDistribution,
} = vi.hoisted(() => ({
  mockGetSummary: vi.fn(),
  mockGetPriorityDistribution: vi.fn(),
  mockGetSlaMetrics: vi.fn(),
  mockGetEscalationMetrics: vi.fn(),
  mockGetDashboardIncidents: vi.fn(),
  mockGetOperationsActiveIncidents: vi.fn(),
  mockGetIncidentStatusDistribution: vi.fn(),
}));

vi.mock('../services/operationsService', () => ({
  getOperationsSummary: (...args: unknown[]) => mockGetSummary(...args),
  getPriorityDistribution: (...args: unknown[]) => mockGetPriorityDistribution(...args),
  getSlaMetrics: (...args: unknown[]) => mockGetSlaMetrics(...args),
  getEscalationMetrics: (...args: unknown[]) => mockGetEscalationMetrics(...args),
  getDashboardIncidents: (...args: unknown[]) => mockGetDashboardIncidents(...args),
  getOperationsActiveIncidents: (...args: unknown[]) => mockGetOperationsActiveIncidents(...args),
  getIncidentStatusDistribution: (...args: unknown[]) => mockGetIncidentStatusDistribution(...args),
}));

const organization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  created_at: '2024-01-01T00:00:00Z',
};

function renderPage(perms: readonly string[], currentOrg: typeof organization | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ctxValue = {
    organizations: currentOrg ? [organization] : [],
    currentOrganization: currentOrg,
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: !!currentOrg,
    selectOrganization: vi.fn(),
    clearCurrentOrganization: vi.fn(),
    createOrganization: vi.fn(),
    refreshOrganizations: vi.fn(),
    hasPermission: (p: string) => perms.includes(p),
    getCurrentRole: () => 'member',
  } as const;

  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <OrganizationContext.Provider value={ctxValue as never}>
          <OperationsCommandCenterPage />
        </OrganizationContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockGetSummary.mockReset();
  mockGetPriorityDistribution.mockReset();
  mockGetSlaMetrics.mockReset();
  mockGetEscalationMetrics.mockReset();
  mockGetDashboardIncidents.mockReset();
  mockGetOperationsActiveIncidents.mockReset();
  mockGetIncidentStatusDistribution.mockReset();

  mockGetSummary.mockResolvedValue({
    open_incidents: 3,
    unassigned_incidents: 1,
    sla_at_risk: 2,
    sla_breached: 1,
    active_escalations: 4,
  });
  mockGetPriorityDistribution.mockResolvedValue({ low: 5, medium: 4, high: 3, critical: 2 });
  mockGetSlaMetrics.mockResolvedValue({
    healthy: 5,
    approaching: 2,
    breached: 1,
    resolved_within_sla: 4,
    response_breaches: 1,
    resolution_breaches: 2,
  });
  mockGetEscalationMetrics.mockResolvedValue({
    active: 2,
    completed: 3,
    cancelled: 1,
    by_level: { 1: 2, 2: 1 },
  });
  mockGetDashboardIncidents.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  mockGetOperationsActiveIncidents.mockResolvedValue([
    {
      id: 'inc-1',
      incident_number: 'INC-001',
      title: 'Search service down',
      status: 'OPEN',
      priority: 'P1',
      assignee_email: 'sre@example.com',
      sla_state: 'AT_RISK',
      escalation_status: 'ACTIVE',
      created_at: '2024-01-15T10:00:00Z',
    },
  ]);
  mockGetIncidentStatusDistribution.mockResolvedValue({
    OPEN: 3,
    ACKNOWLEDGED: 0,
    IN_PROGRESS: 2,
    RESOLVED: 5,
    CLOSED: 1,
  });
});

describe('OperationsCommandCenterPage', () => {
  it('shows organization guidance and no data sections when no organization is selected', () => {
    renderPage(['incident.view'], null);

    expect(screen.getByText('Select an organization')).toBeInTheDocument();
    expect(screen.getByText('Operations Command Center')).toBeInTheDocument();
    expect(mockGetSummary).not.toHaveBeenCalled();
  });

  it('shows a permission notice and issues no dashboard requests without incident.view', () => {
    renderPage([], organization);

    expect(screen.getByText('Permission required')).toBeInTheDocument();
    expect(screen.getByText(/contact an organization administrator/i)).toBeInTheDocument();
    expect(mockGetSummary).not.toHaveBeenCalled();
    expect(mockGetPriorityDistribution).not.toHaveBeenCalled();
  });

  it('composes all operational sections for an authorized member and renders real data', async () => {
    renderPage(['incident.view'], organization);

    expect(screen.getByText('Operational overview for Acme')).toBeInTheDocument();

    // metric card from summary + priority distribution (organization-scoped calls)
    expect(await screen.findByText('Open Incidents')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Incidents')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();

    // charts headline
    expect(screen.getByText('Incidents by Status')).toBeInTheDocument();
    expect(screen.getByText('Incidents by Priority')).toBeInTheDocument();

    // panels
    expect(screen.getByText('Active Incidents')).toBeInTheDocument();
    expect(screen.getAllByText('Critical Incidents').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Recent Incidents')).toBeInTheDocument();

    // SLA + escalation overviews
    expect(screen.getByText('SLA Overview')).toBeInTheDocument();
    expect(screen.getByText('Escalation Overview')).toBeInTheDocument();

    expect(mockGetSummary).toHaveBeenCalledWith('org-1');
    expect(mockGetPriorityDistribution).toHaveBeenCalledWith('org-1');
  });
});