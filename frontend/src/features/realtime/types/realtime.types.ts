/**
 * Realtime types for PulseDesk realtime operations.
 *
 * Mirrors the authoritative backend contract in backend/apps/realtime:
 * - Event envelope: { event, version, organization_id, timestamp, data }
 * - Channel group: operations_org_{organization_uuid}
 * - URL: ws/v1/organizations/<organization_id>/operations/
 * - Server -> client only; the backend logs incoming frames and reads no
 *   authentication from query parameters or the Sec-WebSocket-Protocol
 *   subprotocol. Authentication is performed on the `Authorization: Bearer
 *   <token>` HTTP header during the WebSocket handshake.
 */

/**
 * Connection lifecycle states for the operations WebSocket.
 *
 * - connecting:   handshake in progress (socket created, not yet open)
 * - connected:    handshake complete, receiving events
 * - reconnecting: unexpected close; a bounded backoff retry is scheduled
 * - disconnected: intentionally closed (logout, org switch, unmount)
 * - error:        terminal failure (auth rejection or retries exhausted)
 */
export type RealtimeConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/**
 * Event types published by the backend RealtimeEventService
 * (backend/apps/realtime/events.py). Each maps to a concrete backend event
 * and is validated at the edge before it is emitted to subscribers.
 */
export type RealtimeEventType =
  | 'incident.created'
  | 'incident.updated'
  | 'incident.status_changed'
  | 'incident.assigned'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'attachment.created'
  | 'attachment.deleted'
  | 'sla.warning'
  | 'sla.breached'
  | 'escalation.triggered'
  | 'escalation.completed'
  | 'notification.created';

/**
 * Data payload for incident events (incident.created / updated /
 * status_changed / assigned). Mirrors backend IncidentRealtimeEventSerializer.
 */
export interface IncidentRealtimeData {
  id: string;
  incident_number: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Data payload for comment events (comment.created / updated / deleted).
 * Comment events carry incident_id so the client can target the correct
 * incident comment query cache.
 */
export interface CommentRealtimeData {
  id: string;
  incident_id: string;
}

/**
 * Data payload for attachment events (attachment.created / deleted).
 */
export interface AttachmentRealtimeData {
  id: string;
  incident_id: string;
}

/**
 * Data payload for SLA events (sla.warning / sla.breached).
 */
export interface SlaRealtimeData {
  id: string;
  incident_id: string;
  policy_id: string | null;
  deadline: string | null;
}

/**
 * Data payload for escalation events (escalation.triggered / completed).
 */
export interface EscalationRealtimeData {
  id: string;
  incident_id: string;
  policy_id: string | null;
}

/**
 * Data payload for notification events (notification.created).
 * No frontend notification surface exists yet; treated as an informational
 * event only.
 */
export interface NotificationRealtimeData {
  id: string;
  kind: string;
}

/**
 * Raw wire envelope as published by the backend RealtimeEventService.
 * `data` is deliberately kept untyped at the edge; runtime validation happens
 * in realtimeUtils before the envelope is emitted to subscribers.
 */
export interface RealtimeEventEnvelope {
  event: string;
  version: string;
  organization_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * A validated envelope whose event is a known RealtimeEventType. Emitted to
 * subscribers by realtimeService only after envelope validation and
 * organization scoping have passed.
 */
export interface RealtimeEvent<T = Record<string, unknown>> {
  event: RealtimeEventType;
  version: string;
  organization_id: string;
  timestamp: string;
  data: T;
}

/**
 * Input required to open (or re-establish) an operations WebSocket for the
 * current organization. The access token is sent on the handshake
 * Authorization header by the socket factory; it never appears in the URL.
 */
export interface RealtimeConnectTarget {
  organizationId: string;
  token: string;
}

/**
 * Immutable snapshot of the realtime subsystem, suitable for
 * useSyncExternalStore. A fresh object is created on every state change.
 */
export interface RealtimeConnectionInfo {
  state: RealtimeConnectionState;
  error: string | null;
  reconnectAttempt: number;
  organizationId: string | null;
  lastConnectedAt: string | null;
  lastEventAt: string | null;
  lastEvent: RealtimeEvent<unknown> | null;
  isConnected: boolean;
  isConnecting: boolean;
}

/**
 * Configuration for the bounded reconnect policy.
 */
export interface RealtimeReconnectConfig {
  enabled: boolean;
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}