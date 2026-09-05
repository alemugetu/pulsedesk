/**
 * Tests for EscalationPoliciesPage component, specifically verifying the
 * Escalation Level Role Assignment UX fix.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EscalationPoliciesPage } from '../EscalationPoliciesPage';
import type { EscalationPolicy } from '../../types/escalation.types';
import type { Role } from '../../../organizations/types/role';

// Mock current organization
const mockOrganization = {
  id: 'org-test-uuid',
  name: 'Acme Corp',
  slug: 'acme-corp',
};

vi.mock('../../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => mockOrganization,
}));

// Mock hooks
const mockUseEscalationPolicies = vi.fn();
vi.mock('../../hooks/useEscalationPolicies', () => ({
  useEscalationPolicies: () => mockUseEscalationPolicies(),
}));

const mockUseOrganizationRoles = vi.fn();
vi.mock('../../../organizations/hooks/useOrganizationRoles', () => ({
  useOrganizationRoles: () => mockUseOrganizationRoles(),
}));

// Mock escalation services
const mockCreateEscalationLevel = vi.fn();
const mockUpdateEscalationLevel = vi.fn();
const mockCreateEscalationPolicy = vi.fn();
const mockUpdateEscalationPolicy = vi.fn();
const mockCreateEscalationRule = vi.fn();

vi.mock('../../services/escalationService', () => ({
  createEscalationLevel: (...args: unknown[]) => mockCreateEscalationLevel(...args),
  updateEscalationLevel: (...args: unknown[]) => mockUpdateEscalationLevel(...args),
  createEscalationPolicy: (...args: unknown[]) => mockCreateEscalationPolicy(...args),
  updateEscalationPolicy: (...args: unknown[]) => mockUpdateEscalationPolicy(...args),
  createEscalationRule: (...args: unknown[]) => mockCreateEscalationRule(...args),
}));

const mockRoles: Role[] = [
  {
    id: 'role-viewer-uuid',
    name: 'Viewer',
    slug: 'viewer',
    description: 'Read-only access',
    is_system_role: true,
    permissions: ['organization.view'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-owner-uuid',
    name: 'Organization Owner',
    slug: 'organization-owner',
    description: 'Owner with full access',
    is_system_role: true,
    permissions: ['organization.view', 'role.manage'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-ops-uuid',
    name: 'Operations Manager',
    slug: 'operations-manager',
    description: 'Manages operations',
    is_system_role: true,
    permissions: ['organization.view'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-custom-a-uuid',
    name: 'Custom Role A',
    slug: 'custom-role-a',
    description: 'Custom role description',
    is_system_role: false,
    permissions: ['incident.view'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockPolicies: EscalationPolicy[] = [
  {
    id: 'policy-1',
    name: 'Payment & Core Backend Pipeline',
    description: 'Predefined on-call hierarchy',
    is_active: true,
    is_default: true,
    levels: [
      {
        id: 'level-1',
        level: 1,
        name: 'First responders',
        delay_minutes: 0,
        target_type: 'ROLE',
        target_reference: 'role-ops-uuid',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    rules: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('EscalationPoliciesPage — Escalation Level Role Assignment UX', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    mockUseEscalationPolicies.mockReturnValue({
      data: mockPolicies,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseOrganizationRoles.mockReturnValue({
      data: mockRoles,
      isLoading: false,
      error: null,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <EscalationPoliciesPage />
      </QueryClientProvider>
    );

  it('displays the human-readable role name in the level list instead of the raw role UUID', () => {
    renderComponent();

    // Should show "Role: Operations Manager" instead of "Role: role-ops-uuid"
    expect(screen.getByText(/Target: Role: Operations Manager/i)).toBeInTheDocument();
    expect(screen.queryByText(/role-ops-uuid/i)).not.toBeInTheDocument();
  });

  it('renders a role selection dropdown (not a text input) when Target is Role', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Click "Add Level"
    await user.click(screen.getByRole('button', { name: /add level/i }));

    // Target defaults to Current Assignee; Role dropdown should not be rendered yet
    expect(screen.queryByLabelText(/^Role$/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Role UUID/i)).not.toBeInTheDocument();

    // Change Target to "Role"
    const targetSelect = screen.getByLabelText(/^Target$/i);
    await user.selectOptions(targetSelect, 'ROLE');

    // Role select dropdown should now appear
    const roleSelect = screen.getByLabelText(/^Role$/i);
    expect(roleSelect).toBeInTheDocument();
    expect(roleSelect.tagName.toLowerCase()).toBe('select');

    // Make sure manual Role UUID text input is NOT present
    expect(screen.queryByPlaceholderText(/Role UUID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Role ID/i)).not.toBeInTheDocument();

    // Verify available options include human-readable role names
    expect(screen.getByRole('option', { name: 'Select a role' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Organization Owner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operations Manager' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Viewer' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom Role A' })).toBeInTheDocument();

    // System roles should appear before custom roles
    const options = screen.getAllByRole('option');
    const optionLabels = options.map((o) => o.textContent);
    const ownerIndex = optionLabels.indexOf('Organization Owner');
    const opsIndex = optionLabels.indexOf('Operations Manager');
    const customIndex = optionLabels.indexOf('Custom Role A');

    expect(ownerIndex).toBeLessThan(opsIndex);
    expect(opsIndex).toBeLessThan(customIndex);
  });

  it('submits the selected role UUID to createEscalationLevel when form is saved', async () => {
    const user = userEvent.setup();
    mockCreateEscalationLevel.mockResolvedValueOnce({
      id: 'level-2',
      level: 2,
      name: 'Secondary Escalation',
      delay_minutes: 15,
      target_type: 'ROLE',
      target_reference: 'role-ops-uuid',
    });

    renderComponent();

    await user.click(screen.getByRole('button', { name: /add level/i }));

    // Fill level name
    const nameInput = screen.getByPlaceholderText(/e\.g\. First responders/i);
    await user.type(nameInput, 'Secondary Escalation');

    // Change delay
    const delayInput = screen.getByLabelText(/Delay \(min\)/i);
    await user.clear(delayInput);
    await user.type(delayInput, '15');

    // Switch target to Role
    const targetSelect = screen.getByLabelText(/^Target$/i);
    await user.selectOptions(targetSelect, 'ROLE');

    // Select Operations Manager
    const roleSelect = screen.getByLabelText(/^Role$/i);
    await user.selectOptions(roleSelect, 'role-ops-uuid');

    // Submit form
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(mockCreateEscalationLevel).toHaveBeenCalledTimes(1);
    expect(mockCreateEscalationLevel).toHaveBeenCalledWith(
      'org-test-uuid',
      'policy-1',
      {
        level: 2,
        name: 'Secondary Escalation',
        delay_minutes: 15,
        target_type: 'ROLE',
        target_reference: 'role-ops-uuid',
      }
    );
  });

  it('validates that a role is selected when target is Role', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /add level/i }));

    const nameInput = screen.getByPlaceholderText(/e\.g\. First responders/i);
    await user.type(nameInput, 'Secondary Escalation');

    const targetSelect = screen.getByLabelText(/^Target$/i);
    await user.selectOptions(targetSelect, 'ROLE');

    // Attempt to submit without choosing a role
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(mockCreateEscalationLevel).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Please select a role when target type is Role/i);
  });

  it('pre-selects the existing role when editing a level with a ROLE target', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Click edit on the existing level
    await user.click(screen.getByRole('button', { name: /edit level 1/i }));

    // Role select should be visible and pre-selected with Operations Manager
    const roleSelect = screen.getByLabelText(/^Role$/i) as HTMLSelectElement;
    expect(roleSelect).toBeInTheDocument();
    expect(roleSelect.value).toBe('role-ops-uuid');

    // Change role to Custom Role A
    await user.selectOptions(roleSelect, 'role-custom-a-uuid');

    mockUpdateEscalationLevel.mockResolvedValueOnce({
      id: 'level-1',
      level: 1,
      name: 'First responders',
      delay_minutes: 0,
      target_type: 'ROLE',
      target_reference: 'role-custom-a-uuid',
    });

    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(mockUpdateEscalationLevel).toHaveBeenCalledTimes(1);
    expect(mockUpdateEscalationLevel).toHaveBeenCalledWith(
      'org-test-uuid',
      'policy-1',
      'level-1',
      {
        name: 'First responders',
        delay_minutes: 0,
        target_type: 'ROLE',
        target_reference: 'role-custom-a-uuid',
      }
    );
  });
});
