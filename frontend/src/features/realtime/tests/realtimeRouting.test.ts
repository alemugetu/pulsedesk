/**
 * Tests for the realtime -> query invalidations routing table.
 */

import { describe, it, expect } from 'vitest';
import { getRealtimeInvalidationTargets } from '../utils/realtimeRouting';

const envelopeFor = (event: string, organizationId = 'org-1') => ({
  event,
  organization_id: organizationId,
});

describe('getRealtimeInvalidationTargets', () => {
  it('maps incident events to operations, list, and detail caches', () => {
    for (const event of [
      'incident.created',
      'incident.updated',
      'incident.status_changed',
      'incident.assigned',
    ]) {
      expect(getRealtimeInvalidationTargets(envelopeFor(event), 'org-1')).toEqual([
        ['operations', 'org-1'],
        ['incidents', 'org-1'],
        ['incident', 'org-1'],
      ]);
    }
  });

  it('maps comment events to comment and incident detail caches', () => {
    expect(getRealtimeInvalidationTargets(envelopeFor('comment.created'), 'org-1')).toEqual([
      ['comments', 'org-1'],
      ['incident', 'org-1'],
    ]);
    expect(getRealtimeInvalidationTargets(envelopeFor('comment.deleted'), 'org-1')[0]).toEqual([
      'comments',
      'org-1',
    ]);
  });

  it('maps attachment events to attachment and incident detail caches', () => {
    expect(getRealtimeInvalidationTargets(envelopeFor('attachment.created'), 'org-1')).toEqual([
      ['attachments', 'org-1'],
      ['incident', 'org-1'],
    ]);
  });

  it('maps SLA events to dashboard metrics and incident detail', () => {
    expect(getRealtimeInvalidationTargets(envelopeFor('sla.warning'), 'org-1')).toEqual([
      ['operations', 'org-1'],
      ['incident', 'org-1'],
    ]);
  });

  it('maps escalation events to dashboard metrics, detail, and escalation history', () => {
    expect(getRealtimeInvalidationTargets(envelopeFor('escalation.triggered'), 'org-1')).toEqual([
      ['operations', 'org-1'],
      ['incident', 'org-1'],
      ['incident-escalations', 'org-1'],
    ]);
  });

  it('maps notification events to no cache targets', () => {
    expect(getRealtimeInvalidationTargets(envelopeFor('notification.created'), 'org-1')).toEqual([]);
  });

  it('returns no targets for a mismatched organization (defense in depth)', () => {
    expect(
      getRealtimeInvalidationTargets(envelopeFor('incident.created', 'org-2'), 'org-1')
    ).toEqual([]);
  });

  it('returns no targets without a selected organization', () => {
    expect(getRealtimeInvalidationTargets(envelopeFor('incident.created'), null)).toEqual([]);
  });

  it('returns no targets for unknown event types', () => {
    expect(getRealtimeInvalidationTargets({ event: 'unknown.event', organization_id: 'org-1' }, 'org-1')).toEqual([]);
  });
});