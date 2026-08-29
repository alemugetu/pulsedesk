/**
 * Tests for useIncidentSla hook and utilities.
 */

import { formatTimeRemaining } from '../useIncidentSla';

describe('useIncidentSla utilities', () => {
  describe('formatTimeRemaining', () => {
    it('returns unavailable for an invalid deadline', () => {
      expect(formatTimeRemaining('')).toBe('Unavailable');
    });
    it('formats breached deadline', () => {
      const deadline = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const formatted = formatTimeRemaining(deadline);
      expect(formatted).toBe('Breached');
    });

    it('formats remaining time in minutes', () => {
      const deadline = new Date(Date.now() + 1800000).toISOString(); // 30 minutes from now
      const formatted = formatTimeRemaining(deadline);
      expect(formatted).toMatch(/\d+m/);
    });

    it('formats remaining time in hours', () => {
      const deadline = new Date(Date.now() + 7200000).toISOString(); // 2 hours from now
      const formatted = formatTimeRemaining(deadline);
      expect(formatted).toMatch(/\d+h/);
    });

    it('formats remaining time in days', () => {
      const deadline = new Date(Date.now() + 172800000).toISOString(); // 48 hours from now
      const formatted = formatTimeRemaining(deadline);
      expect(formatted).toMatch(/\d+d/);
    });
  });
});
