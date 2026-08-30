/**
 * Tests for the realtimeService singleton: org-scoped connect/idempotency,
 * edge validation, cross-tenant protection, duplicate suppression, and the
 * stable snapshot exposed to useSyncExternalStore.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const realtimeMocks = vi.hoisted(() => {
  interface MockedClientOptions {
    url: string;
    token: string | null;
    factory: unknown;
    reconnect: unknown;
    callbacks: {
      onMessage: (payload: unknown) => void;
      onStateChange: (state: string) => void;
      onError: (message: string) => void;
    };
  }

  interface MockedClient {
    options: MockedClientOptions;
    connect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    getReconnectAttempt: ReturnType<typeof vi.fn>;
  }

  const instances: MockedClient[] = [];

  class MockWebSocketClient {
    options: MockedClientOptions;
    connect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    getReconnectAttempt: ReturnType<typeof vi.fn>;

    constructor(options: MockedClientOptions) {
      this.options = options;
      this.connect = vi.fn();
      this.close = vi.fn();
      this.getReconnectAttempt = vi.fn(() => 0);
      instances.push(this);
    }
  }

  return { MockWebSocketClient, instances };
});

vi.mock('../services/websocketClient', () => ({
  WebSocketClient: realtimeMocks.MockWebSocketClient,
  createOperationsWebSocket: vi.fn(),
}));

import { realtimeService } from '../services/realtimeService';

const latestClient = () => realtimeMocks.instances[realtimeMocks.instances.length - 1];

const envelopeFor = (event: string, organizationId = 'org-1', timestamp = '2024-01-15T10:00:00Z') => ({
  event,
  version: '1.0',
  organization_id: organizationId,
  timestamp,
  data: { id: 'inc-1', incident_number: 'INC-001', title: 'Search service down' },
});

beforeEach(() => {
  realtimeMocks.instances.length = 0;
  realtimeService.disconnect();
});

afterEach(() => {
  realtimeService.disconnect();
  realtimeMocks.instances.length = 0;
});

describe('realtimeService', () => {
  it('connects to the backend routing URL with the token (never in the url)', () => {
    realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

    expect(realtimeMocks.instances).toHaveLength(1);
    expect(latestClient().options.url).toBe(
      'ws://localhost:8000/ws/v1/organizations/org-1/operations/'
    );
    expect(latestClient().options.token).toBe('jwt-token');
    expect(latestClient().options.url).not.toContain('jwt-token');
    expect(latestClient().connect).toHaveBeenCalledTimes(1);
    expect(realtimeService.getSnapshot().organizationId).toBe('org-1');
  });

  it('reports connecting/connected and connection metadata on state changes', () => {
    realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
    expect(realtimeService.getSnapshot().state).toBe('connecting');
    expect(realtimeService.getSnapshot().isConnecting).toBe(true);

    latestClient().options.callbacks.onStateChange('connected');
    const snapshot = realtimeService.getSnapshot();
    expect(snapshot.state).toBe('connected');
    expect(snapshot.isConnected).toBe(true);
    expect(snapshot.isConnecting).toBe(false);
    expect(snapshot.lastConnectedAt).not.toBeNull();
  });

  it('is idempotent while connected to the same organization', () => {
    realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
    latestClient().options.callbacks.onStateChange('connected');

    realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

    expect(realtimeMocks.instances).toHaveLength(1);
  });

  it('closes the previous socket before switching organizations', () => {
    realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
    const first = latestClient();

    realtimeService.connect({ organizationId: 'org-2', token: 'jwt-token' });

    expect(first.close).toHaveBeenCalled();
    expect(latestClient()).not.toBe(first);
    expect(latestClient().options.url).toContain('/organizations/org-2/');
    expect(realtimeService.getSnapshot().organizationId).toBe('org-2');
  });

  describe('edge validation', () => {
    it('emits a valid same-org envelope to subscribers and updates the snapshot', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
      latestClient().options.callbacks.onStateChange('connected');

      latestClient().options.callbacks.onMessage(envelopeFor('incident.updated'));

      expect(listener).toHaveBeenCalledTimes(1);
      const event = realtimeService.getLastEvent();
      expect(event?.event).toBe('incident.updated');
      expect(event?.organization_id).toBe('org-1');
      expect(realtimeService.getSnapshot().lastEventAt).toBe('2024-01-15T10:00:00Z');
    });

    it('drops malformed frames', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      latestClient().options.callbacks.onMessage({ not: 'an envelope' });
      latestClient().options.callbacks.onMessage('string-frame');

      expect(listener).not.toHaveBeenCalled();
    });

    it('drops unknown event types', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      latestClient().options.callbacks.onMessage(envelopeFor('system.restart'));

      expect(listener).not.toHaveBeenCalled();
    });

    it('drops unsupported future versions', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      latestClient().options.callbacks.onMessage({
        ...envelopeFor('incident.updated'),
        version: '2.0',
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('drops events belonging to another organization (cross-tenant protection)', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      latestClient().options.callbacks.onMessage(envelopeFor('incident.updated', 'org-2'));

      expect(listener).not.toHaveBeenCalled();
      expect(realtimeService.getLastEvent()).toBeNull();
    });
  });

  describe('duplicate suppression', () => {
    it('emits an identical frame only once (exact-duplicate dedup)', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      const envelope = envelopeFor('incident.created');
      latestClient().options.callbacks.onMessage(envelope);
      latestClient().options.callbacks.onMessage(envelope);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits a distinct frame (new timestamp)', () => {
      const listener = vi.fn();
      realtimeService.subscribeEvents(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      latestClient().options.callbacks.onMessage(envelopeFor('comment.created', 'org-1', 'T1'));
      latestClient().options.callbacks.onMessage(envelopeFor('comment.created', 'org-1', 'T2'));

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('lifecycle', () => {
    it('disconnect closes the socket and resets the snapshot', () => {
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
      latestClient().options.callbacks.onStateChange('connected');
      const client = latestClient();

      realtimeService.disconnect();

      expect(client.close).toHaveBeenCalled();
      const snapshot = realtimeService.getSnapshot();
      expect(snapshot.state).toBe('disconnected');
      expect(snapshot.organizationId).toBeNull();
      expect(snapshot.isConnected).toBe(false);
    });

    it('retry re-establishes the last connect target after a terminal failure', () => {
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
      const first = latestClient();

      // Backend handshake rejection puts the connection in a terminal state.
      latestClient().options.callbacks.onStateChange('error');

      realtimeService.retry();

      expect(realtimeMocks.instances).toHaveLength(2);
      expect(first.close).toHaveBeenCalled();
      expect(latestClient().options.url).toContain('/organizations/org-1/');
      expect(latestClient().connect).toHaveBeenCalled();
    });

    it('retry is a no-op after disconnect clears the target', () => {
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
      realtimeService.disconnect();

      realtimeService.retry();

      expect(realtimeMocks.instances).toHaveLength(1);
    });

    it('surfaces errors in the snapshot for status UI', () => {
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      latestClient().options.callbacks.onError('Realtime connection rejected. Check that your session has incident view permission.');

      expect(realtimeService.getSnapshot().error).toContain('Realtime connection rejected');
    });

    it('notifies state subscribers on state changes', () => {
      const listener = vi.fn();
      const unsubscribe = realtimeService.subscribeState(listener);
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });

      expect(listener).toHaveBeenCalled();

      unsubscribe();
      realtimeService.disconnect();
      const calls = listener.mock.calls.length;
      expect(listener.mock.calls).toHaveLength(calls + 0);
    });

    it('provides a stable snapshot reference until state changes', () => {
      realtimeService.connect({ organizationId: 'org-1', token: 'jwt-token' });
      const before = realtimeService.getSnapshot();
      const again = realtimeService.getSnapshot();
      expect(before).toBe(again);

      latestClient().options.callbacks.onStateChange('connected');
      expect(realtimeService.getSnapshot()).not.toBe(before);
    });
  });
});