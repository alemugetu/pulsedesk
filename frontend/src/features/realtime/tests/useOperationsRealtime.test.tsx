/**
 * Tests for useOperationsRealtime: drives the connection and routes validated
 * events into the TanStack Query cache.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/hooks/authContextDef';
import type { AuthContextValue } from '../../auth/types/auth';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import type { OrganizationContextValue } from '../../organizations/context/organizationContextDef';
import { useOperationsRealtime } from '../hooks/useOperationsRealtime';

const realtimeMocks = vi.hoisted(() => {
  const eventListeners: Array<(event: unknown) => void> = [];
  const snapshot = {
    state: 'connected' as const,
    error: null,
    reconnectAttempt: 0,
    organizationId: 'org-1',
    lastConnectedAt: '2024-01-15T10:00:00Z',
    lastEventAt: null,
    lastEvent: null,
    isConnected: true,
    isConnecting: false,
  };
  return {
    eventListeners,
    connect: vi.fn(),
    disconnect: vi.fn(),
    retry: vi.fn(),
    getAccessTokenForRealtime: vi.fn(() => 'jwt-token'),
    subscribeEvents: vi.fn((listener: (event: unknown) => void) => {
      eventListeners.push(listener);
      return () => {
        const index = eventListeners.indexOf(listener);
        if (index >= 0) {
          eventListeners.splice(index, 1);
        }
      };
    }),
    subscribeState: vi.fn(() => () => {}),
    getSnapshot: () => snapshot,
  };
});

vi.mock('../services/realtimeService', () => ({
  realtimeService: realtimeMocks,
  getAccessTokenForRealtime: () => realtimeMocks.getAccessTokenForRealtime(),
}));

const organization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  status: 'ACTIVE' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function authValue(): AuthContextValue {
  return {
    authState: {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'user-1', email: 'sre@example.com', is_active: true, is_verified: true },
      error: null,
    },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    clearError: vi.fn(),
  } as const;
}

function orgValue(): OrganizationContextValue {
  return {
    organizations: [organization],
    currentOrganization: organization,
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: true,
    selectOrganization: vi.fn(),
    clearCurrentOrganization: vi.fn(),
    createOrganization: vi.fn(),
    refreshOrganizations: vi.fn(),
    hasPermission: () => true,
    getCurrentRole: () => 'member',
  } as const;
}

const envelopeFor = (event: string, organizationId = 'org-1', timestamp = '2024-01-15T10:00:00Z') => ({
  event,
  version: '1.0',
  organization_id: organizationId,
  timestamp,
  data: { id: 'inc-1', incident_number: 'INC-001', title: 'Search service down' },
});

beforeEach(() => {
  realtimeMocks.eventListeners.length = 0;
  realtimeMocks.disconnect.mockReset();
  realtimeMocks.connect.mockReset();
  realtimeMocks.getAccessTokenForRealtime.mockReset();
  realtimeMocks.getAccessTokenForRealtime.mockReturnValue('jwt-token');
});

function renderRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue() as never}>
        <OrganizationContext.Provider value={orgValue() as never}>
          {children}
        </OrganizationContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const rendered = renderHook(() => useOperationsRealtime(), { wrapper });
  return { ...rendered, invalidateSpy, queryClient };
}

describe('useOperationsRealtime', () => {
  it('routes incident events into operations, list, and detail caches', () => {
    const { invalidateSpy } = renderRouter();

    act(() => {
      realtimeMocks.eventListeners[0]?.(envelopeFor('incident.created'));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['operations', 'org-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['incidents', 'org-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['incident', 'org-1'] });
  });

  it('routes comment events into comment and incident detail caches', () => {
    const { invalidateSpy } = renderRouter();

    act(() => {
      realtimeMocks.eventListeners[0]?.(envelopeFor('comment.created'));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comments', 'org-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['incident', 'org-1'] });
  });

  it('routes escalation events including the escalation history cache', () => {
    const { invalidateSpy } = renderRouter();

    act(() => {
      realtimeMocks.eventListeners[0]?.(envelopeFor('escalation.triggered'));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['operations', 'org-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['incident-escalations', 'org-1'] });
  });

  it('routes notification events into notifications cache', () => {
    const { invalidateSpy } = renderRouter();

    act(() => {
      realtimeMocks.eventListeners[0]?.(envelopeFor('notification.created'));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('does not invalidate caches for cross-organization events', () => {
    const { invalidateSpy } = renderRouter();

    act(() => {
      realtimeMocks.eventListeners[0]?.(envelopeFor('incident.created', 'org-2'));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('processes an exact duplicate frame only once', () => {
    const { invalidateSpy } = renderRouter();

    act(() => {
      realtimeMocks.eventListeners[0]?.(envelopeFor('incident.updated'));
      realtimeMocks.eventListeners[0]?.(envelopeFor('incident.updated'));
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });

  it('exposes the live connection snapshot', () => {
    const { result } = renderRouter();
    expect(result.current.connection.state).toBe('connected');
  });
});