/**
 * Tests for SlaPolicyList component.
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { SlaPolicyList } from '../SlaPolicyList';

// Mock the hooks
const mockUseSlaPolicies = vi.fn();
vi.mock('../../hooks/useSlaPolicies', () => ({
  useSlaPolicies: () => mockUseSlaPolicies(),
}));

describe('SlaPolicyList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockUseSlaPolicies.mockClear();
  });

  it('renders loading state', () => {
    mockUseSlaPolicies.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      invalidateSlaPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SlaPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const error = new Error('Failed to load');
    mockUseSlaPolicies.mockReturnValue({
      data: null,
      isLoading: false,
      error,
      refetch: vi.fn(),
      invalidateSlaPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SlaPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load SLA policies');
  });

  it('renders empty state', () => {
    mockUseSlaPolicies.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      invalidateSlaPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SlaPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByText(/no sla policies found/i)).toBeInTheDocument();
  });

  it('renders policy list', () => {
    const mockPolicies = [
      {
        id: '1',
        name: 'Standard SLA',
        description: 'Standard policy',
        is_active: true,
        is_default: true,
        targets: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    mockUseSlaPolicies.mockReturnValue({
      data: mockPolicies,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      invalidateSlaPolicies: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SlaPolicyList />
      </QueryClientProvider>
    );

    expect(screen.getByText('Standard SLA')).toBeInTheDocument();
  });
});
