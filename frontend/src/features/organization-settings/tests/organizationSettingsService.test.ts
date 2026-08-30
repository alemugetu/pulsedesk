/**
 * Tests for organizationSettingsService
 * 
 * Tests the API service layer for organization settings operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrganizationSettings, updateOrganizationSettings } from '../services/organizationSettingsService';
import { api } from '../../../api/client';

// Mock the API client
vi.mock('../../../api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('organizationSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrganizationSettings', () => {
    it('should fetch organization settings', async () => {
      const mockSettings = {
        id: 'settings-1',
        default_incident_priority: 'P3',
        default_incident_status: 'OPEN',
        incident_comments_enabled: true,
        notification_incident_emails_enabled: true,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(api.get).mockResolvedValue(mockSettings);

      const result = await getOrganizationSettings('org-123');

      expect(api.get).toHaveBeenCalledWith('/api/v1/organizations/org-123/settings/');
      expect(result).toEqual(mockSettings);
    });

    it('should handle API errors', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      await expect(getOrganizationSettings('org-123')).rejects.toThrow('Network error');
    });
  });

  describe('updateOrganizationSettings', () => {
    it('should update organization settings', async () => {
      const mockUpdatedSettings = {
        id: 'settings-1',
        default_incident_priority: 'P2',
        default_incident_status: 'OPEN',
        incident_comments_enabled: false,
        notification_incident_emails_enabled: true,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(api.patch).mockResolvedValue(mockUpdatedSettings);

      const requestData = {
        default_incident_priority: 'P2' as const,
        incident_comments_enabled: false,
      };

      const result = await updateOrganizationSettings('org-123', requestData);

      expect(api.patch).toHaveBeenCalledWith(
        '/api/v1/organizations/org-123/settings/',
        requestData
      );
      expect(result).toEqual(mockUpdatedSettings);
    });

    it('should handle partial updates', async () => {
      const mockUpdatedSettings = {
        id: 'settings-1',
        default_incident_priority: 'P3',
        default_incident_status: 'OPEN',
        incident_comments_enabled: true,
        notification_incident_emails_enabled: false,
        notification_escalation_emails_enabled: true,
        notification_sla_emails_enabled: true,
        sla_auto_apply_default_policy: true,
        escalation_auto_apply_default_policy: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(api.patch).mockResolvedValue(mockUpdatedSettings);

      const requestData = {
        notification_incident_emails_enabled: false,
      };

      const result = await updateOrganizationSettings('org-123', requestData);

      expect(api.patch).toHaveBeenCalledWith(
        '/api/v1/organizations/org-123/settings/',
        requestData
      );
      expect(result).toEqual(mockUpdatedSettings);
    });

    it('should handle API errors', async () => {
      vi.mocked(api.patch).mockRejectedValue(new Error('Network error'));

      const requestData = {
        default_incident_priority: 'P2' as const,
      };

      await expect(updateOrganizationSettings('org-123', requestData)).rejects.toThrow('Network error');
    });
  });
});
