/**
 * React hook for incident SLA data.
 * 
 * Provides access to SLA data embedded in incident responses.
 * The SLA data comes from the incident API via IncidentSLASummarySerializer.
 * No separate API call is needed - it's extracted from incident data.
 */

import type { IncidentSLASummary } from '../types/sla.types';
import type { Incident } from '../../incidents/types/incident.types';

/**
 * Hook to extract SLA data from an incident
 * 
 * @param incident - The incident object containing embedded SLA data
 * @returns SLA summary data or null if no SLA is configured
 */
export function useIncidentSla(incident: Incident | null): IncidentSLASummary | null {
  if (!incident) {
    return null;
  }

  // SLA data is embedded in the incident response
  // It may be null if no SLA policy was configured at incident creation
  return incident.sla || null;
}

/**
 * Helper to format time remaining until deadline
 * 
 * @param deadline - The SLA deadline as ISO string
 * @returns Formatted time remaining string
 */
export function formatTimeRemaining(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return 'Unavailable';
  }
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Breached';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
