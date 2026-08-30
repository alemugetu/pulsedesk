/**
 * Tests for useRealtimeConnection (the driver hook).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthContext } from '../../auth/hooks/authContextDef';
import type { AuthContextValue } from '../../auth/types/auth';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import type { OrganizationContextValue } from '../../organizations/context/organizationContextDef';

const realtimeMocks = vi.hoisted(() => {
  const snapshot = {
    state: 'disconnected' as const,
    error: null,
    reconnectAttempt: 0,
    organizationId: null,
    lastConnectedAt: null,
    lastEventAt: null,
    lastEvent: null,
    isConnected: false,
    isConnecting: false,
  };
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    retry: vi.fn(),
    getAccessTokenForRealtime: vi.fn<() => string | null>(() => 'jwt-token'),
    subscribeState: vi.fn(() => () => {}),
    getSnapshot: () => snapshot,
  };
});

vi.mock('../services/realtimeService', () => ({
  realtimeService: realtimeMocks,
  getAccessTokenForRealtime: () => realtimeMocks.getAccessTokenForRealtime(),
}));

import { useRealtimeConnection } from '../hooks/useRealtimeConnection';

const organization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  status: 'ACTIVE' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

interface Env {
  authenticated: boolean;
  organizationId: string | null;
  permissions: readonly string[];
}

function makeAuthValue(authenticated: boolean): AuthContextValue {
  return {
    authState: {
      isAuthenticated: authenticated,
      isLoading: false,
      user: authenticated
        ? { id: 'user-1', email: 'sre@example.com', is_active: true, is_verified: true }
        : null,
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

function makeOrgValue(env: Env): OrganizationContextValue {
  const current =
    env.organizationId !== null ? { ...organization, id: env.organizationId } : null;
  return {
    organizations: current ? [current] : [],
    currentOrganization: current,
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: env.organizationId !== null,
    selectOrganization: vi.fn(),
    clearCurrentOrganization: vi.fn(),
    createOrganization: vi.fn(),
    refreshOrganizations: vi.fn(),
    hasPermission: (permission: string) => env.permissions.includes(permission),
    getCurrentRole: () => 'member',
  } as const;
}

/**
 * Module-scoped render environment so rerender() observes the new values
 * (RTL does not pass a changing `initialProps` shape we rely on).
 */
let currentEnv: Env = {
  authenticated: false,
  organizationId: null,
  permissions: [],
};

function StatefulHarness({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={makeAuthValue(currentEnv.authenticated) as never}>
      <OrganizationContext.Provider value={makeOrgValue(currentEnv) as never}>
        {children}
      </OrganizationContext.Provider>
    </AuthContext.Provider>
  );
}

function renderDriver(env: Env) {
  currentEnv = env;
  return renderHook(() => useRealtimeConnection(), { wrapper: StatefulHarness });
}

function setEnv(env: Env) {
  act(() => {
    currentEnv = env;
  });
}

beforeEach(() => {
  realtimeMocks.connect.mockReset();
  realtimeMocks.disconnect.mockReset();
  realtimeMocks.getAccessTokenForRealtime.mockReset();
  realtimeMocks.getAccessTokenForRealtime.mockReturnValue('jwt-token');
  setEnv({ authenticated: false, organizationId: null, permissions: [] });
});

const UNAUTHENTICATED: Env = {
  authenticated: false,
  organizationId: 'org-1',
  permissions: ['incident.view'],
};
const AUTHENTICATED_ORG_1: Env = {
  authenticated: true,
  organizationId: 'org-1',
  permissions: ['incident.view'],
};
const AUTHENTICATED_NO_ORG: Env = {
  authenticated: true,
  organizationId: null,
  permissions: ['incident.view'],
};
const AUTHENTICATED_NO_PERMISSION: Env = {
  authenticated: true,
  organizationId: 'org-1',
  permissions: [],
};

describe('useRealtimeConnection', () => {
  it('does not connect when the user is unauthenticated', () => {
    renderDriver(UNAUTHENTICATED);
    expect(realtimeMocks.connect).not.toHaveBeenCalled();
    expect(realtimeMocks.disconnect).toHaveBeenCalled();
  });

  it('does not connect when no organization is selected', () => {
    renderDriver(AUTHENTICATED_NO_ORG);
    expect(realtimeMocks.connect).not.toHaveBeenCalled();
    expect(realtimeMocks.disconnect).toHaveBeenCalled();
  });

  it('does not connect without incident.view permission', () => {
    renderDriver(AUTHENTICATED_NO_PERMISSION);
    expect(realtimeMocks.connect).not.toHaveBeenCalled();
    expect(realtimeMocks.disconnect).toHaveBeenCalled();
  });

  it('does not connect when no access token is available', () => {
    realtimeMocks.getAccessTokenForRealtime.mockReturnValue(null);
    renderDriver(AUTHENTICATED_ORG_1);
    expect(realtimeMocks.connect).not.toHaveBeenCalled();
  });

  it('connects with the current organization and access token', () => {
    renderDriver(AUTHENTICATED_ORG_1);
    expect(realtimeMocks.connect).toHaveBeenCalledWith({
      organizationId: 'org-1',
      token: 'jwt-token',
    });
  });

  it('disconnects when the session ends (logout)', () => {
    const { rerender } = renderDriver(AUTHENTICATED_ORG_1);
    expect(realtimeMocks.connect).toHaveBeenCalledWith({
      organizationId: 'org-1',
      token: 'jwt-token',
    });

    setEnv(UNAUTHENTICATED);
    rerender();

    expect(realtimeMocks.disconnect).toHaveBeenCalled();
  });

  it('closes the old organization socket before connecting to the new one', () => {
    const { rerender } = renderDriver(AUTHENTICATED_ORG_1);
    expect(realtimeMocks.connect).toHaveBeenCalledWith({
      organizationId: 'org-1',
      token: 'jwt-token',
    });

    setEnv({ ...AUTHENTICATED_ORG_1, organizationId: 'org-2' });
    rerender();

    expect(realtimeMocks.disconnect).toHaveBeenCalled();
    expect(realtimeMocks.connect).toHaveBeenLastCalledWith({
      organizationId: 'org-2',
      token: 'jwt-token',
    });
  });

  it('returns the live connection snapshot from the service', () => {
    const { result } = renderDriver(AUTHENTICATED_ORG_1);
    expect(result.current.state).toBe('disconnected');
    expect(result.current.isConnecting).toBe(false);
  });
});