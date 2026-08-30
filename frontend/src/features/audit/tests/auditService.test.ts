/**
 * Tests for the audit log service layer.
 *
 * Verifies that service functions construct the correct organization-scoped
 * URLs, forward supported backend query parameters, and never emit writes
 * (audit records are append-only and immutable).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiGet = vi.fn();

vi.mock('../../../api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

import {
  getAuditLogs,
  getAuditLog,
} from '../services/auditService';

describe('auditService', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('fetches audit logs with default params (no params)', async () => {
    mockApiGet.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'log-1',
          organization: 'org-123',
          actor: { id: 'user-1', email: 'a@b.com' },
          action: 'incident.created',
          resource_type: 'incident',
          resource_id: 'inc-1',
          changes: {},
          ip_address: '127.0.0.1',
          created_at: '2026-08-01T10:00:00Z',
        },
      ],
    });

    const result = await getAuditLogs('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/audit-logs/',
      { params: undefined }
    );
    expect(result.count).toBe(1);
    expect(result.results[0].action).toBe('incident.created');
  });

  it('forwards supported backend filters and pagination params', async () => {
    mockApiGet.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });

    await getAuditLogs('org-123', {
      action: 'incident.status_changed',
      resource_type: 'incident',
      resource_id: 'inc-42',
      actor_id: 'user-9',
      date_from: '2026-07-01T00:00:00',
      date_to: '2026-07-31T23:59:59',
      page: 2,
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/audit-logs/',
      {
        params: {
          action: 'incident.status_changed',
          resource_type: 'incident',
          resource_id: 'inc-42',
          actor_id: 'user-9',
          date_from: '2026-07-01T00:00:00',
          date_to: '2026-07-31T23:59:59',
          page: 2,
        },
      }
    );
  });

  it('uses the dynamic organization ID in the URL (tenant scope)', async () => {
    mockApiGet.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });

    await getAuditLogs('org-OTHER', { action: 'member.added' });

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-OTHER/audit-logs/',
      { params: { action: 'member.added' } }
    );
  });

  it('fetches a single audit log with scoped URL', async () => {
    mockApiGet.mockResolvedValueOnce({
      id: 'log-8',
      organization: 'org-123',
      actor: null,
      action: 'sla.breached',
      resource_type: 'incident',
      resource_id: 'inc-42',
      changes: { sla_policy_name: 'Gold' },
      ip_address: null,
      created_at: '2026-08-02T11:00:00Z',
    });

    const result = await getAuditLog('org-123', 'log-8');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/audit-logs/log-8/'
    );
    expect(result.action).toBe('sla.breached');
    expect(result.actor).toBeNull();
  });

  it('service exports read operations only (no write API)', async () => {
    const service = await import('../services/auditService');
    expect(service).toHaveProperty('getAuditLogs');
    expect(service).toHaveProperty('getAuditLog');
    expect(service).not.toHaveProperty('createAuditLog');
    expect(service).not.toHaveProperty('updateAuditLog');
    expect(service).not.toHaveProperty('deleteAuditLog');
  });
});