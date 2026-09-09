import { useState, useEffect } from 'react';
import type { IncidentSLASummary, SLAStatus } from '../types/sla.types';
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
 * Helper to format time remaining until deadline with seconds precision
 * 
 * @param deadline - The SLA deadline as ISO string
 * @param now - Optional reference date (defaults to current date)
 * @returns Formatted time remaining string
 */
export function formatTimeRemaining(deadline: string, now: Date = new Date()): string {
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return 'Unavailable';
  }
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Breached';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export interface SlaCountdownState {
  timeRemaining: string;
  isBreached: boolean;
  isCompleted: boolean;
}

/**
 * Live 1-second ticking countdown hook for SLA tracking
 * Automatically freezes when SLA is completed or breached.
 */
export function useSlaCountdown(
  deadline: string,
  completedAt: string | null | undefined,
  status: SLAStatus,
  breached?: boolean
): SlaCountdownState {
  const isCompleted = status === 'COMPLETED' || Boolean(completedAt);
  const isAuthoritativeBreached = status === 'BREACHED' || Boolean(breached);

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // If completed or breached, countdown stops (no timer ticks)
    if (isCompleted || isAuthoritativeBreached) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isCompleted, isAuthoritativeBreached]);

  const deadlineDate = new Date(deadline);
  const isInvalid = Number.isNaN(deadlineDate.getTime());
  const diff = isInvalid ? 0 : deadlineDate.getTime() - now.getTime();
  const isLocallyBreached = !isInvalid && diff <= 0;

  const isBreached = isAuthoritativeBreached || isLocallyBreached;

  let timeRemaining = 'Unavailable';
  if (!isInvalid) {
    if (isBreached) {
      timeRemaining = 'Breached';
    } else {
      timeRemaining = formatTimeRemaining(deadline, now);
    }
  }

  return {
    timeRemaining,
    isBreached,
    isCompleted,
  };
}
