/**
 * Tests for audit log utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  formatAuditTimestamp,
  formatAuditRelativeTime,
  getAuditActionLabel,
  formatActorName,
  isSystemEvent,
  formatIpAddress,
  formatResourceType,
  formatResourceId,
  summarizeChanges,
  formatDateForInput,
  formatDateForApi,
} from '../utils/auditUtils';

describe('formatAuditTimestamp', () => {
  it('formats a valid ISO timestamp into a readable local datetime', () => {
    const result = formatAuditTimestamp('2026-08-01T10:00:00Z');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Aug/);
    expect(result).not.toBe('N/A');
  });

  it('returns input for null/undefined/empty values', () => {
    expect(formatAuditTimestamp(null)).toBe('N/A');
    expect(formatAuditTimestamp(undefined)).toBe('N/A');
    expect(formatAuditTimestamp('')).toBe('N/A');
  });

  it('returns the raw value for unparseable timestamps', () => {
    expect(formatAuditTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('formatAuditRelativeTime', () => {
  it('returns just now for recent timestamps', () => {
    expect(formatAuditRelativeTime(new Date().toISOString())).toBe('Just now');
  });

  it('returns minutes scale for recent events', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatAuditRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('handles null timestamps', () => {
    expect(formatAuditRelativeTime(null)).toBe('N/A');
  });
});

describe('getAuditActionLabel', () => {
  it('maps known backend action codenames to human labels', () => {
    expect(getAuditActionLabel('incident.created')).toBe('Incident Created');
    expect(getAuditActionLabel('sla.breached')).toBe('SLA Breached');
    expect(getAuditActionLabel('escalation.triggered')).toBe('Escalation Triggered');
  });

  it('falls back to the raw value for unknown actions', () => {
    expect(getAuditActionLabel('unknown.action')).toBe('unknown.action');
  });
});

describe('formatActorName', () => {
  it('returns System for null actor', () => {
    expect(formatActorName(null)).toBe('System');
  });

  it('joins first and last name', () => {
    expect(
      formatActorName({ id: 'u1', email: 'a@b.com', first_name: 'Ana', last_name: 'Doe' })
    ).toBe('Ana Doe');
  });

  it('uses first name alone when last name is missing', () => {
    expect(formatActorName({ id: 'u1', email: 'a@b.com', first_name: 'Ana' })).toBe('Ana');
  });

  it('falls back to email when names are missing', () => {
    expect(formatActorName({ id: 'u1', email: 'a@b.com' })).toBe('a@b.com');
  });
});

describe('isSystemEvent', () => {
  it('detects system events (null actor)', () => {
    expect(isSystemEvent({ actor: null })).toBe(true);
    expect(isSystemEvent({ actor: { id: 'u1', email: 'a@b.com' } })).toBe(false);
  });
});

describe('formatIpAddress', () => {
  it('returns placeholder for null IP', () => {
    expect(formatIpAddress(null)).toBe('Unavailable');
  });

  it('returns the raw IP otherwise', () => {
    expect(formatIpAddress('192.0.2.1')).toBe('192.0.2.1');
  });
});

describe('formatResourceType', () => {
  it('title-cases underscore identifiers', () => {
    expect(formatResourceType('sla_policy')).toBe('Sla Policy');
    expect(formatResourceType('escalation_policy')).toBe('Escalation Policy');
  });

  it('handles null/unknown resource types', () => {
    expect(formatResourceType(null)).toBe('Unknown');
  });
});

describe('formatResourceId', () => {
  it('returns short IDs unchanged', () => {
    expect(formatResourceId('inc-42')).toBe('inc-42');
  });

  it('truncates long UUIDs with ellipsis', () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    expect(formatResourceId(uuid)).toBe('12345678…9abc');
  });

  it('returns dash placeholder for missing IDs', () => {
    expect(formatResourceId(null)).toBe('—');
  });
});

describe('summarizeChanges', () => {
  it('returns null for no changes', () => {
    expect(summarizeChanges(null)).toBeNull();
    expect(summarizeChanges(undefined)).toBeNull();
    expect(summarizeChanges({})).toBeNull();
  });

  it('summarizes key-value changes', () => {
    expect(summarizeChanges({ status: 'RESOLVED', priority: 'P1' })).toBe(
      'status: RESOLVED, priority: P1'
    );
  });

  it('handles null and object values safely', () => {
    const out = summarizeChanges({ old: null, nested: { a: 1 } });
    expect(out).toContain('old: null');
    expect(out).toContain('nested: {"a":1}');
  });

  it('limits the summary to the first three entries', () => {
    const out = summarizeChanges({ a: 1, b: 2, c: 3, d: 4 });
    expect(out).toBe('a: 1, b: 2, c: 3');
  });
});

describe('date helpers', () => {
  it('formatDateForInput slices ISO strings for datetime-local', () => {
    expect(formatDateForInput('2026-08-01T10:30:00Z')).toBe('2026-08-01T10:30');
    expect(formatDateForInput(null)).toBe('');
  });

  it('formatDateForApi converts datetime-local values to api timestamps', () => {
    expect(formatDateForApi('2026-08-01T10:30')).toBe('2026-08-01T10:30:00');
    expect(formatDateForApi('2026-08-01T10:30:00Z')).toBe('2026-08-01T10:30:00Z');
    expect(formatDateForApi('')).toBeUndefined();
  });
});