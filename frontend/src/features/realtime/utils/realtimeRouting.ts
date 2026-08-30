/**
 * Realtime -> query cache routing.
 *
 * Maps a validated realtime envelope to the TanStack Query cache keys that
 * must be invalidated so the UI re-fetches authoritative data. The client
 * prefers invalidation + refetch over mutating cached data, because the
 * backend event payloads are projection snapshots, not payloads for every
 * cache shape.
 *
 * All targets are org-scoped prefixes; the Org-scoped guards below ensure a
 * mismatched organization produces no targets (defense in depth alongside the
 * realtimeService scoping).
 */

import { isRealtimeEventType } from './realtimeUtils';
import type { RealtimeEventEnvelope } from '../types/realtime.types';

/**
 * Read-only mapping of event family -> set of query key prefixes to
 * invalidate (each wrapped with the organization id at routing time).
 */
const EVENT_CACHE_MAP: Readonly<
  Record<string, ReadonlyArray<'operations' | 'incidents' | 'incident' | 'comments' | 'attachments' | 'incident-escalations'>>
> = {
  'incident.created': ['operations', 'incidents', 'incident'],
  'incident.updated': ['operations', 'incidents', 'incident'],
  'incident.status_changed': ['operations', 'incidents', 'incident'],
  'incident.assigned': ['operations', 'incidents', 'incident'],
  'comment.created': ['comments', 'incident'],
  'comment.updated': ['comments', 'incident'],
  'comment.deleted': ['comments', 'incident'],
  'attachment.created': ['attachments', 'incident'],
  'attachment.deleted': ['attachments', 'incident'],
  'sla.warning': ['operations', 'incident'],
  'sla.breached': ['operations', 'incident'],
  'escalation.triggered': ['operations', 'incident', 'incident-escalations'],
  'escalation.completed': ['operations', 'incident', 'incident-escalations'],
  'notification.created': [],
};

/**
 * Computes the query-key partials to invalidate for an envelope scoped to the
 * given organization. Returns an empty list when the organization does not
 * match or the event is not a known type.
 */
export function getRealtimeInvalidationTargets(
  envelope: Pick<RealtimeEventEnvelope, 'event' | 'organization_id'>,
  organizationId: string | null
): readonly (readonly string[])[] {
  if (organizationId === null) {
    return [];
  }
  if (envelope.organization_id !== organizationId) {
    return [];
  }
  if (!isRealtimeEventType(envelope.event)) {
    return [];
  }
  const prefixes = EVENT_CACHE_MAP[envelope.event];
  if (!prefixes || prefixes.length === 0) {
    return [];
  }
  return prefixes.map((prefix) => [prefix, organizationId]);
}