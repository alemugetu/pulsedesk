/**
 * Tests for operationsService.
 *
 * Verifies the Operations Command Center API service layer: URL structure
 * (organization-scoped), backend-supported query parameters, and the
 * composition helpers for active incidents and the status distribution.
 * All assertions mirror the backend contract in backend/apps/dashboard/.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOperationsSummary,
  getPriorityDistribution,
  getSlaMetrics,
  getEscalationMetrics,
  getDashboardIncidents,
  getOperationsActiveIncidents,
  getIncidentStatusDistribution,
  ACTIVE_INCIDENT_STATUSES,
} from '../services/operationsService';
import { api } from '../../../api/client';
import type { DashboardIncident } from '../types/operations.types';

vi.mock('../../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const ORG_ID = 'org-123';

const baseIncident = (overrides: Partial<DashboardIncident>): DashboardIncident => ({
  id: '1',
  incident_number: 'INC-001',
  title: 'Test Incident',
  status: 'OPEN',
  priority: 'P1',
  assignee_email: null,
  sla_state: 'HEALTHY',
  escalation_status: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('operationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOperationsSummary', () => {
    it('calls the organization-scoped summary endpoint', async () => {
      const payload = {
        open_incidents: 3,
        unassigned_incidents: 1,
        sla_at_risk: 2,
        sla_breached: 1,
        active_escalations: 0,
      };
      vi.mocked(api.get).mockResolvedValue(payload);

      const result = await getOperationsSummary(ORG_ID);

      expect(api.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/dashboard/summary/');
      expect(result).toEqual(payload);
    });

    it('propagates API errors', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));
      await expect(getOperationsSummary(ORG_ID)).rejects.toThrow('Network error');
    });
  });

  describe('getPriorityDistribution', () => {
    it('calls the priority-distribution endpoint', async () => {
      const payload = { low: 4, medium: 3, high: 2, critical: 1 };
      vi.mocked(api.get).mockResolvedValue(payload);

      const result = await getPriorityDistribution(ORG_ID);

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/organizations/org-123/dashboard/priority-distribution/'
      );
      expect(result).toEqual(payload);
    });
  });

  describe('getSlaMetrics', () => {
    it('calls the sla-metrics endpoint', async () => {
      const payload = {
        healthy: 5,
        approaching: 2,
        breached: 1,
        resolved_within_sla: 4,
        response_breaches: 1,
        resolution_breaches: 2,
      };
      vi.mocked(api.get).mockResolvedValue(payload);

      const result = await getSlaMetrics(ORG_ID);

      expect(api.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/dashboard/sla-metrics/');
      expect(result).toEqual(payload);
    });
  });

  describe('getEscalationMetrics', () => {
    it('calls the escalation-metrics endpoint', async () => {
      const payload = { active: 2, completed: 3, cancelled: 1, by_level: { '1': 2, '2': 1 } };
      vi.mocked(api.get).mockResolvedValue(payload);

      const result = await getEscalationMetrics(ORG_ID);

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/organizations/org-123/dashboard/escalation-metrics/'
      );
      expect(result).toEqual(payload);
    });
  });

  describe('getDashboardIncidents', () => {
    it('calls the incidents endpoint without params when none given', async () => {
      const payload = { count: 0, next: null, previous: null, results: [] };
      vi.mocked(api.get).mockResolvedValue(payload);

      const result = await getDashboardIncidents(ORG_ID);

      expect(api.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/dashboard/incidents/', {
        params: undefined,
      });
      expect(result).toEqual(payload);
    });

    it('passes backend-supported filters through as query params', async () => {
      vi.mocked(api.get).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });

      await getDashboardIncidents(ORG_ID, {
        status: 'OPEN',
        priority: 'P1',
        sla_state: 'BREACHED',
        ordering: '-created_at',
        page_size: 5,
      });

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/organizations/org-123/dashboard/incidents/',
        {
          params: {
            status: 'OPEN',
            priority: 'P1',
            sla_state: 'BREACHED',
            ordering: '-created_at',
            page_size: 5,
          },
        }
      );
    });
  });

  describe('ACTIVE_INCIDENT_STATUSES', () => {
    it('matches the backend open statuses (order-insensitive set)', () => {
      expect([...ACTIVE_INCIDENT_STATUSES].sort()).toEqual([
        'ACKNOWLEDGED',
        'IN_PROGRESS',
        'OPEN',
      ]);
    });
  });

  describe('getOperationsActiveIncidents', () => {
    it('requests each active status with ordering and page_size, then merges and sorts newest first', async () => {
      vi.mocked(api.get).mockImplementation((_url: string, config?: { params?: Record<string, unknown> }) => {
        const status = config?.params?.status as string;
        if (status === 'OPEN') {
          return Promise.resolve({
            count: 1,
            next: null,
            previous: null,
            results: [baseIncident({ id: 'o1', incident_number: 'INC-001', status: 'OPEN', created_at: '2024-01-03T00:00:00Z' })],
          });
        }
        if (status === 'ACKNOWLEDGED') {
          return Promise.resolve({
            count: 1,
            next: null,
            previous: null,
            results: [baseIncident({ id: 'a1', incident_number: 'INC-002', status: 'ACKNOWLEDGED', created_at: '2024-01-02T00:00:00Z' })],
          });
        }
        return Promise.resolve({
          count: 1,
          next: null,
          previous: null,
          results: [baseIncident({ id: 'i1', incident_number: 'INC-003', status: 'IN_PROGRESS', created_at: '2024-01-04T00:00:00Z' })],
        });
      });

      const result = await getOperationsActiveIncidents(ORG_ID, 5);

      expect(api.get).toHaveBeenCalledTimes(3);
      for (const status of ACTIVE_INCIDENT_STATUSES) {
        expect(api.get).toHaveBeenCalledWith(
          `/api/v1/organizations/org-123/dashboard/incidents/`,
          { params: { status, ordering: '-created_at', page_size: 5 } }
        );
      }
      // newest first
      expect(result.map((incident) => incident.id)).toEqual(['i1', 'o1', 'a1']);
    });

    it('caps the merged results at the requested limit', async () => {
      vi.mocked(api.get).mockResolvedValue({
        count: 3,
        next: null,
        previous: null,
        results: [
          baseIncident({ id: 'x1', status: 'OPEN', created_at: '2024-01-01T00:00:00Z' }),
          baseIncident({ id: 'x2', status: 'OPEN', incident_number: 'INC-004', created_at: '2024-01-02T00:00:00Z' }),
          baseIncident({ id: 'x3', status: 'OPEN', incident_number: 'INC-005', created_at: '2024-01-03T00:00:00Z' }),
        ],
      });

      const result = await getOperationsActiveIncidents(ORG_ID, 2);

      expect(result.length).toBe(2);
    });
  });

  describe('getIncidentStatusDistribution', () => {
    it('requests page_size=1 for every status and maps count into the distribution', async () => {
      vi.mocked(api.get).mockImplementation((_url: string, config?: { params?: Record<string, unknown> }) => {
        const status = config?.params?.status as string;
        return Promise.resolve({
          count: status === 'RESOLVED' ? 0 : 2,
          next: null,
          previous: null,
          results: [],
        });
      });

      const result = await getIncidentStatusDistribution(ORG_ID);

      expect(api.get).toHaveBeenCalledTimes(5);
      const statuses = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      for (const status of statuses) {
        expect(api.get).toHaveBeenCalledWith(
          `/api/v1/organizations/org-123/dashboard/incidents/`,
          { params: { status, page_size: 1 } }
        );
      }
      expect(result).toEqual({
        OPEN: 2,
        ACKNOWLEDGED: 2,
        IN_PROGRESS: 2,
        RESOLVED: 0,
        CLOSED: 2,
      });
    });
  });
});