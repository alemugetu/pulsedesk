/**
 * WebSocketClient
 *
 * Thin, testable wrapper around a WebSocket connection for the operations
 * realtime feed. Owns socket lifecycle, text-frame JSON parsing, bounded
 * reconnect backoff, and terminal handling of backend auth close codes.
 *
 * Authentication note: the backend contract authenticates the handshake via
 * the `Authorization: Bearer <token>` HTTP header (backend
 * apps/realtime/permissions.py). The browser WebSocket API cannot attach HTTP
 * headers, so the socket factory picks the best transport available:
 *   - runtimes that can set handshake headers (setRequestHeader) use the
 *     Authorization header (production/gateway deployments), and
 *   - everywhere else the JWT is offered as a Sec-WebSocket-Protocol
 *     subprotocol (`pulsedesk.realtime.<token>`), which development backends
 *     may honor (backend REALTIME_ALLOW_SUBPROTOCOL_AUTH, dev-only).
 * The token never appears in the URL. Production deployments must front the
 * WS endpoint with something that can present the header (a same-origin
 * gateway or a header-capable WebSocket client); the connection states that
 * result from an unauthenticated handshake (close 4001/4003) are surfaced
 * honestly as `error` and are never silently retried.
 */

import type { RealtimeConnectionState } from '../types/realtime.types';
import { isAuthenticationRejection } from '../utils/realtimeUtils';

/**
 * Subprotocol used to carry the access token when the runtime cannot set the
 * Authorization header. Must match SUBPROTOCOL_AUTH_PREFIX in
 * backend/apps/realtime/permissions.py.
 */
export const REALTIME_AUTH_SUBPROTOCOL_PREFIX = 'pulsedesk.realtime.';

/**
 * Structural subset of the DOM WebSocket needed by the client. The DOM
 * WebSocket satisfies it; tests supply a lightweight fake.
 */
export type RealtimeSocket = WebSocket;

/**
 * Creates the underlying socket. The token is provided so a runtime that can
 * present HTTP headers (or a platform-specific factory) can authenticate the
 * handshake without the token ever appearing in the URL.
 */
export type RealtimeSocketFactory = (url: string, token: string | null) => RealtimeSocket;

export interface RealtimeReconnectPolicy {
  enabled: boolean;
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export interface RealtimeSocketCallbacks {
  onMessage: (payload: unknown) => void;
  onStateChange: (state: RealtimeConnectionState) => void;
  onError: (message: string) => void;
}

export interface WebSocketClientOptions {
  url: string;
  token: string | null;
  factory: RealtimeSocketFactory;
  reconnect: RealtimeReconnectPolicy;
  callbacks: RealtimeSocketCallbacks;
}

const DEFAULT_RECONNECT: RealtimeReconnectPolicy = {
  enabled: true,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  maxAttempts: 10,
};

/** Restartable socket that may also expose setRequestHeader on some runtimes. */
type HeaderCapableSocket = RealtimeSocket & {
  setRequestHeader?: (name: string, value: string) => void;
};

/**
 * Default socket factory. Attaches the Authorization header when the runtime
 * supports it; otherwise the token travels as a Sec-WebSocket-Protocol
 * subprotocol (dev backends honor it). The token never appears in the URL.
 *
 * Capability is detected from the WebSocket prototype — never by opening a
 * throwaway socket, which would trigger a real (unauthenticated) handshake
 * and produce spurious connection errors.
 */
export function createOperationsWebSocket(
  url: string,
  token: string | null
): RealtimeSocket {
  const canSetRequestHeaders =
    typeof (WebSocket as unknown as { prototype: HeaderCapableSocket })
      .prototype?.setRequestHeader === 'function';
  if (canSetRequestHeaders && token) {
    const socket = new WebSocket(url);
    (socket as unknown as HeaderCapableSocket).setRequestHeader?.(
      'Authorization',
      `Bearer ${token}`
    );
    return socket;
  }
  if (token) {
    return new WebSocket(url, [`${REALTIME_AUTH_SUBPROTOCOL_PREFIX}${token}`]);
  }
  return new WebSocket(url);
}

export class WebSocketClient {
  private readonly url: string;
  private readonly token: string | null;
  private readonly factory: RealtimeSocketFactory;
  private readonly callbacks: RealtimeSocketCallbacks;
  private readonly reconnect: RealtimeReconnectPolicy;

  private socket: RealtimeSocket | null = null;
  private state: RealtimeConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = true;

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.token = options.token;
    this.factory = options.factory;
    this.callbacks = options.callbacks;
    this.reconnect = options.reconnect ?? DEFAULT_RECONNECT;
  }

  /** Opens the socket (or starts the connect flow). Safe to call repeatedly. */
  connect(): void {
    this.intentionalClose = false;
    this.clearReconnectTimer();
    this.openSocket();
  }

  /**
   * Intentionally closes the connection. No further connect attempts are made
   * until connect() is called again.
   */
  close(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close(1000, 'Client closed');
      } catch {
        // The socket may already be closed.
      }
    }
    this.setState('disconnected');
  }

  getState(): RealtimeConnectionState {
    return this.state;
  }

  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  private openSocket(): void {
    let socket: RealtimeSocket;
    try {
      socket = this.factory(this.url, this.token);
    } catch {
      this.callbacks.onError('Could not create WebSocket connection.');
      this.setState('error');
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }
      this.reconnectAttempt = 0;
      this.setState('connected');
    };

    socket.onmessage = (event: { data: unknown }) => {
      if (this.socket !== socket) {
        return;
      }
      let payload: unknown;
      try {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        payload = JSON.parse(raw);
      } catch {
        this.callbacks.onError('Received a non-JSON WebSocket message.');
        return;
      }
      this.callbacks.onMessage(payload);
    };

    socket.onerror = () => {
      if (this.socket !== socket) {
        return;
      }
      this.callbacks.onError('WebSocket connection error.');
    };

    socket.onclose = (event: { code: number; reason?: string }) => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.handleClose(event.code);
    };

    this.setState('connecting');
  }

  private handleClose(closeCode: number): void {
    if (this.intentionalClose) {
      this.setState('disconnected');
      return;
    }
    if (isAuthenticationRejection(closeCode)) {
      this.callbacks.onError('Realtime connection rejected. Check that your session has incident view permission.');
      this.setState('error');
      return;
    }
    if (this.reconnect.enabled && this.reconnectAttempt < this.reconnect.maxAttempts) {
      const delay = this.computeReconnectDelay();
      this.reconnectAttempt += 1;
      this.setState('reconnecting');
      this.scheduleReconnect(delay);
      return;
    }
    this.callbacks.onError('Realtime connection closed; reconnect attempts exhausted.');
    this.setState('disconnected');
  }

  private computeReconnectDelay(): number {
    const delay = this.reconnect.baseDelayMs * 2 ** this.reconnectAttempt;
    return Math.min(delay, this.reconnect.maxDelayMs);
  }

  private scheduleReconnect(delayMs: number): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalClose || this.socket !== null) {
        return;
      }
      this.openSocket();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: RealtimeConnectionState): void {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.callbacks.onStateChange(state);
  }
}