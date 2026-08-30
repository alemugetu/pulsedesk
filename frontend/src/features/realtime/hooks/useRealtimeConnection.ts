/**
 * useRealtimeConnection
 *
 * Connection driver hook. Mounted exactly once at the application shell level
 * (via RealtimeConnectionBridge); derives the connect target from auth
 * (authenticated user + access token), organization context (current
 * organization), and the `incident.view` permission that the backend requires
 * for the operations stream. Returns the live connection snapshot.
 *
 * The effect keys on { organizationId, token } so the socket is opened for the
 * current organization and re-opened when the organization changes (closing
 * the previous socket first).
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { env } from '../../../config/env';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  useCurrentOrganization,
  useOrganizationContext,
} from '../../organizations/context/organizationContextDef';
import { getAccessTokenForRealtime, realtimeService } from '../services/realtimeService';
import type { RealtimeConnectionInfo } from '../types/realtime.types';

export interface UseRealtimeConnectionOptions {
  /** App-level opt-out (e.g. feature flag or environment). Default true. */
  enabled?: boolean;
}

export function useRealtimeConnection(
  options?: UseRealtimeConnectionOptions
): RealtimeConnectionInfo {
  const enabled = options?.enabled ?? true;
  const { authState } = useAuth();
  const organization = useCurrentOrganization();
  const { hasPermission } = useOrganizationContext();

  const target = useMemo(() => {
    if (!enabled || !env.ENABLE_WEBSOCKETS) {
      return null;
    }
    if (!authState.isAuthenticated || !authState.user) {
      return null;
    }
    const token = getAccessTokenForRealtime();
    if (!token) {
      return null;
    }
    if (!organization) {
      return null;
    }
    if (!hasPermission('incident.view')) {
      return null;
    }
    return { organizationId: organization.id, token };
  }, [enabled, authState.isAuthenticated, authState.user, organization, hasPermission]);

  const targetOrganizationId = target?.organizationId ?? null;
  const targetToken = target?.token ?? null;

  useEffect(() => {
    if (targetOrganizationId === null || targetToken === null) {
      realtimeService.disconnect();
      return;
    }
    realtimeService.connect({ organizationId: targetOrganizationId, token: targetToken });
    return () => {
      realtimeService.disconnect();
    };
  }, [targetOrganizationId, targetToken]);

  return useSyncExternalStore(
    (listener) => realtimeService.subscribeState(listener),
    () => realtimeService.getSnapshot()
  );
}