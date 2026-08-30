/**
 * Tests for realtime utilities: edge validation, URL building, payload
 * accessors, dedup fingerprints, and backend close-code handling.
 */

import { describe, it, expect } from 'vitest';
import {
  AUTHENTICATION_CLOSE_CODES,
  SUPPORTED_EVENT_TYPES,
  buildOperationsWebSocketUrl,
  eventBelongsToOrganization,
  getEventFingerprint,
  getIncidentIdFromEventData,
  getRealtimeEventLabel,
  isAuthenticationRejection,
  isRealtimeEventEnvelope,
  isRealtimeEventType,
  REALTIME_EVENT_VERSION,
} from '../utils/realtimeUtils';

const VALID_ENVELOPE = {
  event: 'incident.updated',
  version: '1.0',
  organization_id: 'org-1',
  timestamp: '2024-01-15T10:00:00Z',
  data: { id: 'inc-1', title: 'Search service down' },
};

describe('SUPPORTED_EVENT_TYPES', () => {
  it('mirrors the backend controlled set exactly', () => {
    expect(SUPPORTED_EVENT_TYPES).toEqual([
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
    ]);
  });

  it('declares the backend event version', () => {
    expect(REALTIME_EVENT_VERSION).toBe('1.0');
  });
});

describe('isRealtimeEventType', () => {
  it('accepts every supported backend event type', () => {
    for (const event of SUPPORTED_EVENT_TYPES) {
      expect(isRealtimeEventType(event)).toBe(true);
    }
  });

  it('rejects unknown, malformed, and non-string values', () => {
    expect(isRealtimeEventType('incident.deleted')).toBe(false);
    expect(isRealtimeEventType('')).toBe(false);
    expect(isRealtimeEventType(42)).toBe(false);
    expect(isRealtimeEventType(undefined)).toBe(false);
  });
});

describe('isRealtimeEventEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    expect(isRealtimeEventEnvelope(VALID_ENVELOPE)).toBe(true);
  });

  it('rejects null / non-object / arrays', () => {
    expect(isRealtimeEventEnvelope(null)).toBe(false);
    expect(isRealtimeEventEnvelope('incident.updated')).toBe(false);
    expect(isRealtimeEventEnvelope([VALID_ENVELOPE])).toBe(false);
  });

  it('rejects envelopes with an unsupported event type', () => {
    expect(
      isRealtimeEventEnvelope({ ...VALID_ENVELOPE, event: 'system.restart' })
    ).toBe(false);
  });

  it('rejects envelopes with missing or wrongly-typed fields', () => {
    expect(isRealtimeEventEnvelope({ ...VALID_ENVELOPE, version: 1 })).toBe(false);
    expect(isRealtimeEventEnvelope({ ...VALID_ENVELOPE, organization_id: 5 })).toBe(false);
    expect(isRealtimeEventEnvelope({ ...VALID_ENVELOPE, timestamp: null })).toBe(false);
    expect(isRealtimeEventEnvelope({ ...VALID_ENVELOPE, data: 'not-object' })).toBe(false);
    expect(
      isRealtimeEventEnvelope({ event: 'incident.created', organization_id: 'org-1' })
    ).toBe(false);
  });
});

describe('eventBelongsToOrganization', () => {
  it('matches when organization ids are equal', () => {
    expect(eventBelongsToOrganization({ organization_id: 'org-1' }, 'org-1')).toBe(true);
  });

  it('rejects mismatches and null org ids', () => {
    expect(eventBelongsToOrganization({ organization_id: 'org-1' }, 'org-2')).toBe(false);
    expect(eventBelongsToOrganization({ organization_id: 'org-1' }, null)).toBe(false);
  });
});

describe('buildOperationsWebSocketUrl', () => {
  it('builds the backend routing URL for an organization', () => {
    expect(buildOperationsWebSocketUrl('ws://localhost:8000', 'org-1')).toBe(
      'ws://localhost:8000/ws/v1/organizations/org-1/operations/'
    );
  });

  it('normalizes trailing slashes on the base URL', () => {
    expect(buildOperationsWebSocketUrl('ws://localhost:8000/', 'org-1')).toBe(
      'ws://localhost:8000/ws/v1/organizations/org-1/operations/'
    );
  });

  it('URL-encodes the organization id and never embeds a token', () => {
    const url = buildOperationsWebSocketUrl('wss://ops.example.com', 'org with spaces');
    expect(url).toContain('org%20with%20spaces');
    expect(url).not.toContain('token');
    expect(url).not.toContain('Bearer');
  });
});

describe('getIncidentIdFromEventData', () => {
  it('reads `id` from incident payloads', () => {
    expect(getIncidentIdFromEventData({ id: 'inc-1', incident_number: 'INC-001' })).toBe('inc-1');
  });

  it('reads `incident_id` from comment/attachment/sla/escalation payloads', () => {
    expect(getIncidentIdFromEventData({ id: 'comment-1', incident_id: 'inc-1' })).toBe('inc-1');
    expect(getIncidentIdFromEventData({ comment_id: 'comment-1', incident_id: 'inc-1' })).toBe('inc-1');
    expect(getIncidentIdFromEventData({ attachment_id: 'att-1', incident_id: 'inc-1' })).toBe('inc-1');
  });

  it('returns null for payloads with no usable id', () => {
    expect(getIncidentIdFromEventData({})).toBe(null);
    expect(getIncidentIdFromEventData({ id: '' })).toBe(null);
    expect(getIncidentIdFromEventData({ id: 42 })).toBe(null);
  });
});

describe('getEventFingerprint', () => {
  it('produces identical fingerprints for identical frames', () => {
    expect(getEventFingerprint(VALID_ENVELOPE)).toBe(getEventFingerprint(VALID_ENVELOPE));
  });

  it('produces different fingerprints when any field differs', () => {
    expect(getEventFingerprint(VALID_ENVELOPE)).not.toBe(
      getEventFingerprint({ ...VALID_ENVELOPE, timestamp: '2024-01-15T11:00:00Z' })
    );
    expect(getEventFingerprint(VALID_ENVELOPE)).not.toBe(
      getEventFingerprint({ ...VALID_ENVELOPE, data: { id: 'inc-2' } })
    );
  });
});

describe('isAuthenticationRejection', () => {
  it('treats backend auth + permission close codes as rejections', () => {
    expect(AUTHENTICATION_CLOSE_CODES).toEqual([4001, 4003]);
    expect(isAuthenticationRejection(4001)).toBe(true);
    expect(isAuthenticationRejection(4003)).toBe(true);
  });

  it('treats other close codes as reconnectable', () => {
    expect(isAuthenticationRejection(4000)).toBe(false);
    expect(isAuthenticationRejection(1006)).toBe(false);
    expect(isAuthenticationRejection(1000)).toBe(false);
  });
});

describe('getRealtimeEventLabel', () => {
  it('returns a human label for supported events', () => {
    expect(getRealtimeEventLabel('incident.created')).toBe('Incident created');
    expect(getRealtimeEventLabel('sla.breached')).toBe('SLA breached');
  });
});