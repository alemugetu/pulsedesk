/**
 * RealtimeService
 *
 * App-wide singleton that owns the organization-scoped operations WebSocket.
 * Responsibilities:
 * - One socket per organization: switching organizations closes the old
 *   socket before opening the new one (never two live sockets).
 * - Edge validation: only trusted envelope-shaped, supported, same-org,
 *   supported-version frames reach subscribers.
 * - Exact-duplicate suppression for back-to-back identical frames.
 * - A stable snapshot for useSyncExternalStore plus a remove-only set of
 *   listeners (subscribers self-manage their lifetime via the returned
 *   unsubscribe function).
 *
 * Browser limitation (honest by design): the backend authenticates the
 * handshake with an Authorization header, which the browser WebSocket API
 * cannot set. In a plain browser the handshake is rejected (close 4001/4003),
 * surfaced as the `error` state, and never retried in a loop.
 */

import { env } from '../../../config/env';
import { getAccessToken } from '../../auth/services/tokenService';
import {
  buildOperationsWebSocketUrl,
  eventBelongsToOrganization,
  getEventFingerprint,
  isRealtimeEventEnvelope,
  REALTIME_EVENT_VERSION,
} from '../utils/realtimeUtils';
import { WebSocketClient, createOperationsWebSocket } from './websocketClient';
import type {
  RealtimeConnectionInfo,
  RealtimeConnectionState,
  RealtimeConnectTarget,
  RealtimeEvent,
  RealtimeEventType,
} from '../types/realtime.types';

export interface RealtimeServiceSnapshot extends RealtimeConnectionInfo {
  /** Raw envelope of the most recent accepted event (mirrored in lastEvent). */
  lastEvent: RealtimeEvent<unknown> | null;
}

const INITIAL_SNAPSHOT: RealtimeServiceSnapshot = {
  state: 'disconnected',
  error: null,
  reconnectAttempt: 0,
  organizationId: null,
  lastConnectedAt: null,
  lastEventAt: null,
  lastEvent: null,
  isConnected: false,
  isConnecting: false,
};

class RealtimeService {
  private snapshot: RealtimeServiceSnapshot = INITIAL_SNAPSHOT;
  private client: WebSocketClient | null = null;
  private lastTarget: RealtimeConnectTarget | null = null;
  private lastFingerprint: string | null = null;
  private readonly stateListeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: RealtimeEvent<unknown>) => void>();

  /**
   * Opens (or reuses) the operations socket for the given organization.
   * Idempotent: calling again with the same organization while connecting,
   * connected, or reconnecting is a no-op. Changing organization closes the
   * existing socket first.
   */
  connect(target: RealtimeConnectTarget): void {
    const activeState = this.snapshot.state;
    const connectedToOrg =
      this.client !== null && this.snapshot.organizationId === target.organizationId;
    const isActive = connectedToOrg &&
      (activeState === 'connecting' ||
        activeState === 'connected' ||
        activeState === 'reconnecting');
    if (isActive) {
      return;
    }

    this.teardownClient();
    this.lastTarget = target;
    this.lastFingerprint = null;

    const url = buildOperationsWebSocketUrl(env.WS_BASE_URL, target.organizationId);
    this.client = new WebSocketClient({
      url,
      token: target.token,
      factory: createOperationsWebSocket,
      reconnect: {
        enabled: true,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        maxAttempts: 10,
      },
      callbacks: {
        onMessage: (payload) => this.handleIncoming(payload),
        onStateChange: (state) => this.handleStateChange(state),
        onError: (message) => this.handleError(message),
      },
    });
    this.patchSnapshot({
      state: 'connecting',
      error: null,
      reconnectAttempt: 0,
      organizationId: target.organizationId,
      isConnecting: true,
      isConnected: false,
    });
    this.client.connect();
  }

  /**
   * Intentionally closes the socket and forgets the connect target (logout,
   * session end, organization switch). The snapshot is fully reset: the seen
   * event history is session-scoped and must not leak to the next session.
   * No further reconnect attempts are made.
   */
  disconnect(): void {
    this.teardownClient();
    this.lastTarget = null;
    this.lastFingerprint = null;
    this.patchSnapshot({ ...INITIAL_SNAPSHOT });
  }

  /** Re-establishes the connection after a transient failure. */
  retry(): void {
    if (this.lastTarget !== null) {
      this.connect(this.lastTarget);
    }
  }

  /** Subscribes to connection-state changes. Returns an unsubscribe function. */
  subscribeState(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /** Subscribes to validated realtime events. Returns an unsubscribe function. */
  subscribeEvents(listener: (event: RealtimeEvent<unknown>) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /** Stable snapshot reference, recreated only when the connection changes. */
  getSnapshot(): RealtimeServiceSnapshot {
    return this.snapshot;
  }

  getLastEvent(): RealtimeEvent<unknown> | null {
    return this.snapshot.lastEvent;
  }

  private teardownClient(): void {
    if (this.client !== null) {
      this.client.close();
      this.client = null;
    }
  }

  private handleIncoming(payload: unknown): void {
    if (!isRealtimeEventEnvelope(payload)) {
      return;
    }
    const organizationId = this.snapshot.organizationId;
    if (!eventBelongsToOrganization(payload, organizationId)) {
      return;
    }
    if (payload.version !== REALTIME_EVENT_VERSION) {
      return;
    }
    const fingerprint = getEventFingerprint(payload);
    if (fingerprint === this.lastFingerprint) {
      return;
    }
    this.lastFingerprint = fingerprint;

    const event: RealtimeEvent<unknown> = {
      event: payload.event as RealtimeEventType,
      version: payload.version,
      organization_id: payload.organization_id,
      timestamp: payload.timestamp,
      data: payload.data,
    };
    this.patchSnapshot({
      lastEvent: event,
      lastEventAt: event.timestamp,
    });
    this.eventListeners.forEach((listener) => {
      listener(event);
    });
  }

  private handleStateChange(state: RealtimeConnectionState): void {
    if (state === 'connected') {
      this.patchSnapshot({
        state,
        error: null,
        isConnected: true,
        isConnecting: false,
        lastConnectedAt: new Date().toISOString(),
      });
      return;
    }
    if (state === 'connecting') {
      this.patchSnapshot({
        state,
        isConnecting: true,
        isConnected: false,
      });
      return;
    }
    if (state === 'reconnecting') {
      this.patchSnapshot({
        state,
        isConnecting: true,
        isConnected: false,
        reconnectAttempt: this.client?.getReconnectAttempt() ?? 0,
      });
      return;
    }
    this.patchSnapshot({
      state,
      isConnecting: false,
      isConnected: false,
    });
  }

  private handleError(message: string): void {
    this.patchSnapshot({ error: message });
  }

  private patchSnapshot(patch: Partial<RealtimeServiceSnapshot>): void {
    const next: RealtimeServiceSnapshot = { ...this.snapshot, ...patch };
    if (snapshotSignature(next) === snapshotSignature(this.snapshot)) {
      this.snapshot = next;
      return;
    }
    this.snapshot = next;
    this.stateListeners.forEach((listener) => {
      listener();
    });
  }
}

function snapshotSignature(snapshot: RealtimeServiceSnapshot): string {
  const { state, error, reconnectAttempt, organizationId, lastConnectedAt, lastEventAt, isConnected, isConnecting } = snapshot;
  return JSON.stringify([
    state,
    error,
    reconnectAttempt,
    organizationId,
    lastConnectedAt,
    lastEventAt,
    isConnected,
    isConnecting,
  ]);
}

/**
 * App-wide realtime service singleton. Consumed by the realtime hooks;
 * all interaction with the operations socket flows through this instance.
 */
export const realtimeService = new RealtimeService();

/** Re-exported for callers that construct explicit targets (token hygiene). */
export function getAccessTokenForRealtime(): string | null {
  return getAccessToken();
}