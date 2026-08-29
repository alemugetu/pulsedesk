/**
 * Tests for EscalationPolicyList component.
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { EscalationPolicyList } from '../EscalationPolicyList';

// Mock the hooks
const mockUseEscalationPolicies = vi.fn();
vi.mock('../../hooks/useEscalationPolicies', () => ({
  useEscalationPolicies: () => mockUseEscalationPolicies(),
}));

describe('EscalationPolicyList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockUseEscalationPolicies.mockClear();
  });

  it('renders loading state', () => {
    mockUseEscalationPolicies.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      invalidateEscalationPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EscalationPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const error = new Error('Failed to load');
    mockUseEscalationPolicies.mockReturnValue({
      data: null,
      isLoading: false,
      error,
      refetch: vi.fn(),
      invalidateEscalationPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EscalationPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load escalation policies');
  });

  it('renders empty state', () => {
    mockUseEscalationPolicies.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      invalidateEscalationPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EscalationPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByText(/no escalation policies found/i)).toBeInTheDocument();
  });

  it('renders policy list', () => {
    const mockPolicies = [
      {
        id: '1',
        name: 'Standard Escalation',
        description: 'Standard escalation policy',
        is_active: true,
        is_default: true,
        levels: [],
        rules: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    mockUseEscalationPolicies.mockReturnValue({
      data: mockPolicies,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      invalidateEscalationPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EscalationPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByText('Standard Escalation')).toBeInTheDocument();
  });
});
