import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EscalationLevelList } from '../EscalationLevelList';
import type { EscalationLevel } from '../../types/escalation.types';
import type { Role } from '../../../organizations/types/role';

describe('EscalationLevelList', () => {
  const mockRoles: Role[] = [
    {
      id: 'role-ops-123',
      name: 'Operations Manager',
      slug: 'operations-manager',
      description: 'Operations',
      is_system_role: true,
      permissions: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const levels: EscalationLevel[] = [
    {
      id: 'lvl-1',
      level: 1,
      name: 'Tier 1 Support',
      delay_minutes: 0,
      target_type: 'ASSIGNEE',
      target_reference: '',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'lvl-2',
      level: 2,
      name: 'Tier 2 Support',
      delay_minutes: 30,
      target_type: 'ROLE',
      target_reference: 'role-ops-123',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  it('renders assignee target correctly', () => {
    render(<EscalationLevelList levels={[levels[0]]} />);
    expect(screen.getByText(/Target: Current Assignee/i)).toBeInTheDocument();
  });

  it('resolves role UUID to human-readable role name when roles prop is provided', () => {
    render(<EscalationLevelList levels={levels} roles={mockRoles} />);
    expect(screen.getByText(/Target: Role: Operations Manager/i)).toBeInTheDocument();
    expect(screen.queryByText(/role-ops-123/i)).not.toBeInTheDocument();
  });

  it('does not expose raw UUID even if role is not found in roles prop', () => {
    render(<EscalationLevelList levels={levels} roles={[]} />);
    expect(screen.getByText(/Target: Role$/i)).toBeInTheDocument();
    expect(screen.queryByText(/role-ops-123/i)).not.toBeInTheDocument();
  });
});
