/**
 * Tests for WebSocketClient lifecycle: connect/open, JSON handling, bounded
 * reconnect backoff, intentional close, and backend auth-close handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, createOperationsWebSocket } from '../services/websocketClient';
import type { RealtimeSocket } from '../services/websocketClient';
import type { RealtimeConnectionState } from '../types/realtime.types';

interface FakeSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  close: ReturnType<typeof vi.fn>;
}

function createFakeSocket(): FakeSocket {
  return {
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close: vi.fn(),
  };
}

interface Harness {
  client: WebSocketClient;
  sockets: FakeSocket[];
  states: RealtimeConnectionState[];
  errors: string[];
  messages: unknown[];
}

const POLICY = { enabled: true, baseDelayMs: 1000, maxDelayMs: 4000, maxAttempts: 2 };

function createHarness(
  reconnect = POLICY,
  url = 'ws://localhost:8000/ws/v1/organizations/org-1/operations/'
): Harness {
  const sockets: FakeSocket[] = [];
  const states: RealtimeConnectionState[] = [];
  const errors: string[] = [];
  const messages: unknown[] = [];

  const client = new WebSocketClient({
    url,
    token: 'jwt-token',
    reconnect,
    factory: (() => {
      const socket = createFakeSocket();
      sockets.push(socket);
      return socket as unknown as RealtimeSocket;
    }),
    callbacks: {
      onMessage: (payload) => {
        messages.push(payload);
      },
      onStateChange: (state) => {
        states.push(state);
      },
      onError: (message) => {
        errors.push(message);
      },
    },
  });

  return { client, sockets, states, errors, messages };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WebSocketClient', () => {
  it('opens a socket for the configured url and reports connecting/connected', () => {
    const { client, sockets, states } = createHarness();

    client.connect();
    expect(sockets).toHaveLength(1);
    expect(states).toEqual(['connecting']);

    sockets[0].onopen?.();
    expect(states).toEqual(['connecting', 'connected']);
    expect(client.getState()).toBe('connected');
  });

  it('uses the socket factory url + token (token never appended to the url)', () => {
    const seen: Array<{ url: string; token: string | null }> = [];
    const client = new WebSocketClient({
      url: 'ws://example.test/ws/v1/organizations/org-1/operations/',
      token: 'jwt-token',
      factory: (url, token) => {
        seen.push({ url, token });
        return createFakeSocket() as unknown as RealtimeSocket;
      },
      reconnect: POLICY,
      callbacks: { onMessage: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() },
    });

    client.connect();
    expect(seen).toEqual([
      {
        url: 'ws://example.test/ws/v1/organizations/org-1/operations/',
        token: 'jwt-token',
      },
    ]);
  });

  it('parses text JSON frames and forwards the payload', () => {
    const { client, sockets, messages } = createHarness();
    client.connect();
    sockets[0].onopen?.();

    sockets[0].onmessage?.({ data: '{"event":"incident.updated","organization_id":"org-1"}' });
    expect(messages).toEqual([{ event: 'incident.updated', organization_id: 'org-1' }]);
  });

  it('drops non-JSON frames and reports a recoverable error', () => {
    const { client, sockets, messages, errors } = createHarness();
    client.connect();
    sockets[0].onopen?.();

    sockets[0].onmessage?.({ data: 'not json' });
    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(client.getState()).toBe('connected');
  });

  it('reconnects with bounded backoff after an unexpected close', () => {
    const { client, sockets, states } = createHarness();

    client.connect();
    sockets[0].onopen?.();
    sockets[0].onclose?.({ code: 1006 });

    expect(client.getState()).toBe('reconnecting');
    expect(client.getReconnectAttempt()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    expect(states).toContain('connecting');

    sockets[1].onopen?.();
    expect(client.getState()).toBe('connected');
    expect(client.getReconnectAttempt()).toBe(0);
  });

  it('doubles the backoff delay between attempts', () => {
    const { client, sockets } = createHarness();

    client.connect();
    sockets[0].onclose?.({ code: 1006 }); // attempt 1 -> delay 1000ms
    expect(client.getReconnectAttempt()).toBe(1);

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1].onclose?.({ code: 1006 }); // attempt 2 -> delay 2000ms
    expect(client.getReconnectAttempt()).toBe(2);

    // Next attempt should be scheduled at base * 2 = 2000ms.
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('gives up after maxAttempts and reports the failure', () => {
    const { client, sockets, errors } = createHarness(POLICY);

    client.connect();
    sockets[0].onclose?.({ code: 1006 }); // attempt 1
    vi.advanceTimersByTime(1000);
    sockets[1].onclose?.({ code: 1006 }); // attempt 2 (max)
    vi.advanceTimersByTime(2000);
    sockets[2].onclose?.({ code: 1006 }); // exhausted

    expect(client.getState()).toBe('disconnected');
    expect(errors).toContain('Realtime connection closed; reconnect attempts exhausted.');

    // No further sockets are created after the attempts are exhausted.
    vi.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(3);
  });

  it('does not reconnect across an intentional close', () => {
    const { client, sockets, states } = createHarness();

    client.connect();
    sockets[0].onopen?.();

    const closeSpy = sockets[0].close;
    client.close();
    expect(closeSpy).toHaveBeenCalledWith(1000, 'Client closed');
    expect(client.getState()).toBe('disconnected');

    vi.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(1);
    expect(states.filter((state) => state === 'connecting')).toHaveLength(1);
  });

  it('stops reconnecting when the backend rejects authentication (close 4001)', () => {
    const { client, sockets, errors } = createHarness();

    client.connect();
    sockets[0].onclose?.({ code: 4001 });

    expect(client.getState()).toBe('error');
    expect(errors).toHaveLength(1);
    vi.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(1);
  });

  it('stops reconnecting when the backend rejects permissions (close 4003)', () => {
    const { client, sockets } = createHarness();

    client.connect();
    sockets[0].onclose?.({ code: 4003 });

    expect(client.getState()).toBe('error');
    vi.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(1);
  });

  it('cancelPending timer when close happens while reconnecting', () => {
    const { client, sockets } = createHarness();

    client.connect();
    sockets[0].onclose?.({ code: 1006 });
    expect(client.getState()).toBe('reconnecting');

    client.close();
    vi.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(1);
    expect(client.getState()).toBe('disconnected');
  });

  it('connect after close opens a fresh socket', () => {
    const { client, sockets } = createHarness();

    client.connect();
    client.close();
    client.connect();

    expect(sockets).toHaveLength(2);
    sockets[1].onopen?.();
    expect(client.getState()).toBe('connected');
  });
});

describe('createOperationsWebSocket transports', () => {
  let captured: RecordingWebSocket[];

  class RecordingWebSocket {
    url: string;
    protocols: readonly string[];
    headers: Record<string, string>;

    constructor(url: string, protocols?: string | string[]) {
      this.url = url;
      this.protocols = Array.isArray(protocols)
        ? protocols
        : protocols
          ? [protocols]
          : [];
      this.headers = {};
      captured.push(this);
    }
  }

  // Capability is detected from the WebSocket prototype, so header support
  // must be declared as a prototype method (matching browser behavior where
  // per-instance properties are irrelevant).
  class HeaderCapableWebSocket extends RecordingWebSocket {
    setRequestHeader(name: string, value: string): void {
      this.headers[name] = value;
    }
  }

  class HeaderLessWebSocket extends RecordingWebSocket {}

  beforeEach(() => {
    captured = [];
    vi.stubGlobal('WebSocket', HeaderCapableWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Authorization header when the runtime supports it', () => {
    const socket = createOperationsWebSocket('ws://localhost:8000/ws/', 'jwt-token');

    expect(captured).toHaveLength(1);
    expect(captured[0].protocols).toEqual([]);
    expect(captured[0].headers).toEqual({ Authorization: 'Bearer jwt-token' });
    expect(socket).toBe(captured[0] as unknown as WebSocket);
  });

  it('uses the auth subprotocol when the runtime cannot set request headers', () => {
    vi.stubGlobal('WebSocket', HeaderLessWebSocket);
    const socket = createOperationsWebSocket('ws://localhost:8000/ws/', 'jwt-token');

    // Exactly one socket is created, carrying the token as the subprotocol.
    expect(captured).toHaveLength(1);
    expect(captured[0].protocols).toEqual(['pulsedesk.realtime.jwt-token']);
    expect(socket).toBe(captured[0] as unknown as WebSocket);
  });

  it('opens a plain socket when no token is available', () => {
    const socket = createOperationsWebSocket('ws://localhost:8000/ws/', null);

    expect(captured).toHaveLength(1);
    expect(captured[0].protocols).toEqual([]);
    expect(captured[0].headers).toEqual({});
    expect(socket).toBe(captured[0] as unknown as WebSocket);
  });
});