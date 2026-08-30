/**
 * Tests for organizationSettingsUtils
 * 
 * Tests utility functions for settings management.
 */

import { describe, it, expect } from 'vitest';
import {
  areSettingsEqual,
  getChangedFields,
  isValidIncidentPriority,
  isValidIncidentStatus,
  formatSettingsError,
} from '../utils/organizationSettingsUtils';
import type { OrganizationSettings } from '../types/organizationSettings.types';

describe('organizationSettingsUtils', () => {
  const mockSettings: OrganizationSettings = {
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

  describe('areSettingsEqual', () => {
    it('should return true when no changes', () => {
      const current = {};
      expect(areSettingsEqual(mockSettings, current)).toBe(true);
    });

    it('should return true when values match original', () => {
      const current = {
        default_incident_priority: 'P3' as const,
        incident_comments_enabled: true,
      };
      expect(areSettingsEqual(mockSettings, current)).toBe(true);
    });

    it('should return false when values differ', () => {
      const current = {
        default_incident_priority: 'P2' as const,
      };
      expect(areSettingsEqual(mockSettings, current)).toBe(false);
    });

    it('should return false when boolean differs', () => {
      const current = {
        incident_comments_enabled: false,
      };
      expect(areSettingsEqual(mockSettings, current)).toBe(false);
    });
  });

  describe('getChangedFields', () => {
    it('should return empty object when no changes', () => {
      const current = {};
      const changed = getChangedFields(mockSettings, current);
      expect(changed).toEqual({});
    });

    it('should return only changed fields', () => {
      const current = {
        default_incident_priority: 'P2' as const,
        incident_comments_enabled: false,
      };
      const changed = getChangedFields(mockSettings, current);
      expect(changed).toEqual({
        default_incident_priority: 'P2',
        incident_comments_enabled: false,
      });
    });

    it('should ignore undefined values', () => {
      const current = {
        default_incident_priority: undefined,
        incident_comments_enabled: false,
      };
      const changed = getChangedFields(mockSettings, current);
      expect(changed).toEqual({
        incident_comments_enabled: false,
      });
    });

    it('should ignore unchanged values', () => {
      const current = {
        default_incident_priority: 'P3' as const,
        incident_comments_enabled: false,
      };
      const changed = getChangedFields(mockSettings, current);
      expect(changed).toEqual({
        incident_comments_enabled: false,
      });
    });
  });

  describe('isValidIncidentPriority', () => {
    it('should return true for valid priorities', () => {
      expect(isValidIncidentPriority('P1')).toBe(true);
      expect(isValidIncidentPriority('P2')).toBe(true);
      expect(isValidIncidentPriority('P3')).toBe(true);
      expect(isValidIncidentPriority('P4')).toBe(true);
    });

    it('should return false for invalid priorities', () => {
      expect(isValidIncidentPriority('P5')).toBe(false);
      expect(isValidIncidentPriority('P0')).toBe(false);
      expect(isValidIncidentPriority('INVALID')).toBe(false);
      expect(isValidIncidentPriority('')).toBe(false);
    });
  });

  describe('isValidIncidentStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidIncidentStatus('OPEN')).toBe(true);
      expect(isValidIncidentStatus('ACKNOWLEDGED')).toBe(true);
      expect(isValidIncidentStatus('IN_PROGRESS')).toBe(true);
      expect(isValidIncidentStatus('RESOLVED')).toBe(true);
      expect(isValidIncidentStatus('CLOSED')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidIncidentStatus('INVALID')).toBe(false);
      expect(isValidIncidentStatus('')).toBe(false);
      expect(isValidIncidentStatus('open')).toBe(false);
    });
  });

  describe('formatSettingsError', () => {
    it('should format error with detail field', () => {
      const error = { detail: 'Permission denied' };
      expect(formatSettingsError(error)).toBe('Permission denied');
    });

    it('should format error with message field', () => {
      const error = { message: 'Network error' };
      expect(formatSettingsError(error)).toBe('Network error');
    });

    it('should return default message for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(formatSettingsError(error)).toBe('An error occurred while updating settings');
    });

    it('should return default message for null/undefined', () => {
      expect(formatSettingsError(null)).toBe('An error occurred while updating settings');
      expect(formatSettingsError(undefined)).toBe('An error occurred while updating settings');
    });
  });
});
