/**
 * Tests for incidentService
 * 
 * Tests the API service layer for incident operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIncidents, getIncident, createIncident, updateIncident } from '../services/incidentService';
import { api } from '../../../api/client';

// Mock the API client
vi.mock('../../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('incidentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIncidents', () => {
    it('should fetch incidents for an organization', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            incident_number: 'INC-001',
            title: 'Test Incident',
            status: 'OPEN',
            priority: 'P1',
            description: '',
            category: null,
            reporter: { id: 'user1', email: 'test@example.com' },
            assignee: null,
            sla: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            resolved_at: null,
          },
        ],
        meta: {
          count: 1,
          next: null,
          previous: null,
          page: 1,
          page_size: 25,
          total_pages: 1,
        },
      };

      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await getIncidents('org-123', { status: 'OPEN' });

      expect(api.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/incidents', {
        params: { status: 'OPEN' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      await expect(getIncidents('org-123')).rejects.toThrow('Network error');
    });
  });

  describe('getIncident', () => {
    it('should fetch a single incident', async () => {
      const mockIncident = {
        id: '1',
        incident_number: 'INC-001',
        title: 'Test Incident',
        status: 'OPEN',
        priority: 'P1',
        description: '',
        category: null,
        reporter: { id: 'user1', email: 'test@example.com' },
        assignee: null,
        sla: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        resolved_at: null,
      };

      vi.mocked(api.get).mockResolvedValue(mockIncident);

      const result = await getIncident('org-123', 'incident-1');

      expect(api.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/incidents/incident-1/');
      expect(result).toEqual(mockIncident);
    });
  });

  describe('createIncident', () => {
    it('should create a new incident', async () => {
      const mockIncident = {
        id: '1',
        incident_number: 'INC-001',
        title: 'New Incident',
        status: 'OPEN',
        priority: 'P2',
        description: 'Test description',
        category: null,
        reporter: { id: 'user1', email: 'test@example.com' },
        assignee: null,
        sla: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        resolved_at: null,
      };

      vi.mocked(api.post).mockResolvedValue(mockIncident);

      const requestData = {
        title: 'New Incident',
        description: 'Test description',
        priority: 'P2' as const,
      };

      const result = await createIncident('org-123', requestData);

      expect(api.post).toHaveBeenCalledWith('/api/v1/organizations/org-123/incidents', requestData);
      expect(result).toEqual(mockIncident);
    });
  });

  describe('updateIncident', () => {
    it('should update an incident', async () => {
      const mockIncident = {
        id: '1',
        incident_number: 'INC-001',
        title: 'Updated Incident',
        status: 'IN_PROGRESS',
        priority: 'P2',
        description: 'Updated description',
        category: null,
        reporter: { id: 'user1', email: 'test@example.com' },
        assignee: null,
        sla: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        resolved_at: null,
      };

      vi.mocked(api.patch).mockResolvedValue(mockIncident);

      const requestData = {
        title: 'Updated Incident',
        status: 'IN_PROGRESS' as const,
      };

      const result = await updateIncident('org-123', 'incident-1', requestData);

      expect(api.patch).toHaveBeenCalledWith(
        '/api/v1/organizations/org-123/incidents/incident-1/',
        requestData
      );
      expect(result).toEqual(mockIncident);
    });
  });
});
