/**
 * Tests for the report service layer.
 *
 * Verifies that service functions construct the correct URLs and pass the
 * expected parameters to the shared API client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiGet = vi.fn();

vi.mock('../../../api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

import {
  getIncidentSummary,
  getIncidentsByStatus,
  getIncidentsByPriority,
  getIncidentsByCategory,
  getIncidentTrend,
  getSLAPerformance,
  getAverageResolutionTime,
  getEscalationActivity,
} from '../services/reportService';

describe('reportService', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('fetches incident summary with organization ID', async () => {
    mockApiGet.mockResolvedValueOnce({
      total_incidents: 10,
      open_incidents: 3,
      resolved_incidents: 5,
      closed_incidents: 2,
      unassigned_incidents: 1,
      critical_incidents: 1,
    });

    const result = await getIncidentSummary('org-123', {
      start: '2026-01-01T00:00:00',
      end: '2026-01-31T23:59:59',
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/summary/',
      {
        params: { start: '2026-01-01T00:00:00', end: '2026-01-31T23:59:59' },
      }
    );
    expect(result.total_incidents).toBe(10);
  });

  it('fetches incidents by status', async () => {
    mockApiGet.mockResolvedValueOnce({ OPEN: 5, ACKNOWLEDGED: 2, IN_PROGRESS: 1, RESOLVED: 3, CLOSED: 1 });

    const result = await getIncidentsByStatus('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/incidents/by-status/',
      { params: undefined }
    );
    expect(result.OPEN).toBe(5);
  });

  it('fetches incidents by priority', async () => {
    mockApiGet.mockResolvedValueOnce({ P1: 1, P2: 2, P3: 4, P4: 3 });

    const result = await getIncidentsByPriority('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/incidents/by-priority/',
      { params: undefined }
    );
    expect(result.P1).toBe(1);
  });

  it('fetches incidents by category', async () => {
    mockApiGet.mockResolvedValueOnce({
      categories: [
        { category_id: 'cat-1', category_name: 'Network', count: 5 },
        { category_id: null, category_name: 'Uncategorized', count: 2 },
      ],
    });

    const result = await getIncidentsByCategory('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/incidents/by-category/',
      { params: undefined }
    );
    expect(result.categories).toHaveLength(2);
  });

  it('fetches incident trend with granularity', async () => {
    mockApiGet.mockResolvedValueOnce({
      granularity: 'weekly',
      data: [{ week: '2026-W01', count: 3 }],
    });

    const result = await getIncidentTrend('org-123', {
      start: '2026-01-01T00:00:00',
      end: '2026-01-31T23:59:59',
    }, 'weekly');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/incidents/trend/',
      {
        params: {
          start: '2026-01-01T00:00:00',
          end: '2026-01-31T23:59:59',
          granularity: 'weekly',
        },
      }
    );
    expect(result.granularity).toBe('weekly');
  });

  it('fetches SLA performance', async () => {
    mockApiGet.mockResolvedValueOnce({
      total_sla_incidents: 10,
      compliant_incidents: 8,
      breached_incidents: 2,
      completed_sla_records: 9,
      compliance_percentage: 80.0,
    });

    const result = await getSLAPerformance('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/sla/',
      { params: undefined }
    );
    expect(result.compliance_percentage).toBe(80.0);
  });

  it('fetches average resolution time', async () => {
    mockApiGet.mockResolvedValueOnce({
      average_resolution_seconds: 3600,
      resolved_incident_count: 5,
    });

    const result = await getAverageResolutionTime('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/resolution-time/',
      { params: undefined }
    );
    expect(result.average_resolution_seconds).toBe(3600);
  });

  it('fetches escalation activity', async () => {
    mockApiGet.mockResolvedValueOnce({
      total_escalation_events: 4,
      by_level: { '1': 2, '2': 2 },
      by_trigger_type: { SLA_BREACH: 3, MANUAL: 1 },
    });

    const result = await getEscalationActivity('org-123');

    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/organizations/org-123/reports/escalations/',
      { params: undefined }
    );
    expect(result.total_escalation_events).toBe(4);
  });
});

