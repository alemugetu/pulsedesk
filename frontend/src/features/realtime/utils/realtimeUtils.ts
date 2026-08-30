/**
 * Realtime utilities.
 *
 * Edge validation equals the authoritative backend contract:
 * backend/apps/realtime/events.py (event types + envelope version) and
 * backend/apps/realtime/serializers.py (payload shapes). The backend sends
 * an envelope of { event, version, organization_id, timestamp, data } and the
 * client drops anything that does not satisfy this contract.
 */

import type {
  RealtimeEventEnvelope,
  RealtimeEventType,
} from '../types/realtime.types';

/**
 * Controlled set of realtime event types, mirroring
 * backend RealtimeEventType.all_values(). Order matches the backend enum.
 */
export const SUPPORTED_EVENT_TYPES: readonly string[] = [
  'incident.created',
  'incident.updated',
  'incident.status_changed',
  'incident.assigned',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'attachment.created',
  'attachment.deleted',
  'sla.warning',
  'sla.breached',
  'escalation.triggered',
  'escalation.completed',
  'notification.created',
];

/**
 * Backend event envelope version (backend EVENT_VERSION = "1.0").
 */
export const REALTIME_EVENT_VERSION = '1.0';

/**
 * Close codes the backend uses to reject a WebSocket connection
 * (backend/apps/realtime/consumers.py). Receiving any of these means the
 * server will not accept this session; the client must not reconnect in a
 * loop.
 */
export const AUTHENTICATION_CLOSE_CODES: readonly number[] = [4001, 4003];

/**
 * Type guard: is the value a known realtime event type string?
 */
export function isRealtimeEventType(value: unknown): value is RealtimeEventType {
  return typeof value === 'string' && SUPPORTED_EVENT_TYPES.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runtime validation of the backend event envelope. Returns false for
 * malformed, unknown-version, or unexpected-shape messages so the service can
 * drop them before they reach subscribers.
 */
export function isRealtimeEventEnvelope(value: unknown): value is RealtimeEventEnvelope {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.event !== 'string' || !isRealtimeEventType(value.event)) {
    return false;
  }
  if (typeof value.version !== 'string') {
    return false;
  }
  if (typeof value.organization_id !== 'string') {
    return false;
  }
  if (typeof value.timestamp !== 'string') {
    return false;
  }
  return isRecord(value.data);
}

/**
 * True when the envelope describes an event for the given organization.
 * Enforced before the event is emitted so a client observing organization A
 * can never receive work belonging to organization B.
 */
export function eventBelongsToOrganization(
  envelope: Pick<RealtimeEventEnvelope, 'organization_id'>,
  organizationId: string | null
): boolean {
  return organizationId !== null && envelope.organization_id === organizationId;
}

/**
 * Builds the operations WebSocket URL for an organization.
 *
 * Conforms to the backend routing pattern
 * ws/v1/organizations/<organization_id>/operations/ and tolerates a trailing
 * slash (or missing trailing slash) on the configured base URL. The access
 * token deliberately never appears in the URL; it travels on the handshake
 * Authorization header via the socket factory.
 */
export function buildOperationsWebSocketUrl(
  baseUrl: string,
  organizationId: string
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedOrg = encodeURIComponent(organizationId);
  return `${normalizedBase}/ws/v1/organizations/${normalizedOrg}/operations/`;
}

/**
 * Safely extracts the incident id from an event payload.
 *
 * Comment/attachment/sla/escalation/notification payloads (and delete
 * payloads) carry `incident_id` (with `id` being the resource's own id);
 * incident payloads carry only `id`. Returns null when the payload has
 * neither value in a valid shape.
 */
export function getIncidentIdFromEventData(
  data: Record<string, unknown>
): string | null {
  const incidentId = data.incident_id;
  if (typeof incidentId === 'string' && incidentId.length > 0) {
    return incidentId;
  }
  const id = data.id;
  if (typeof id === 'string' && id.length > 0) {
    return id;
  }
  return null;
}

/**
 * Deterministic fingerprint of a validated envelope used for lightweight
 * exact-duplicate suppression. The backend publishes no event id or sequence
 * number, so identical frames (same event, org, timestamp, data) received
 * back-to-back (e.g. a double-broadcast) are treated as one delivery.
 */
export function getEventFingerprint(envelope: {
  event: string;
  organization_id: string;
  timestamp: string;
  data: unknown;
}): string {
  return JSON.stringify([
    envelope.event,
    envelope.organization_id,
    envelope.timestamp,
    envelope.data,
  ]);
}

/**
 * True when a WebSocket close code signals the backend rejected the
 * handshake (authentication or permission). The client stops reconnecting
 * when the server will not accept the session.
 */
export function isAuthenticationRejection(closeCode: number): boolean {
  return AUTHENTICATION_CLOSE_CODES.includes(closeCode);
}

/**
 * Human-readable label for a realtime event type, used by status/diagnostic
 * UI and tests.
 */
export function getRealtimeEventLabel(event: RealtimeEventType): string {
  const labels: Readonly<Record<RealtimeEventType, string>> = {
    'incident.created': 'Incident created',
    'incident.updated': 'Incident updated',
    'incident.status_changed': 'Incident status changed',
    'incident.assigned': 'Incident assigned',
    'comment.created': 'Comment added',
    'comment.updated': 'Comment updated',
    'comment.deleted': 'Comment removed',
    'attachment.created': 'Attachment added',
    'attachment.deleted': 'Attachment removed',
    'sla.warning': 'SLA at risk',
    'sla.breached': 'SLA breached',
    'escalation.triggered': 'Escalation triggered',
    'escalation.completed': 'Escalation complete',
    'notification.created': 'Notification created',
  };
  return labels[event];
}