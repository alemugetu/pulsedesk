/**
 * Incident utilities for PulseDesk.
 * 
 * Helper functions for formatting, styling, and manipulating incident data.
 */

import type { IncidentStatus, IncidentPriority, Incident } from '../types/incident.types';

/**
 * Get status display text
 */
export function getStatusDisplayText(status: IncidentStatus): string {
  const statusMap: Record<IncidentStatus, string> = {
    OPEN: 'Open',
    ACKNOWLEDGED: 'Acknowledged',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  };
  return statusMap[status] || status;
}

/**
 * Get priority display text
 */
export function getPriorityDisplayText(priority: IncidentPriority): string {
  const priorityMap: Record<IncidentPriority, string> = {
    P1: 'P1 — Critical',
    P2: 'P2 — High',
    P3: 'P3 — Medium',
    P4: 'P4 — Low',
  };
  return priorityMap[priority] || priority;
}

/**
 * Get status color class for Tailwind
 * Returns colors matching the PulseDesk design system
 */
export function getStatusColorClass(status: IncidentStatus): string {
  const colorMap: Record<IncidentStatus, string> = {
    OPEN: 'bg-blue-500',
    ACKNOWLEDGED: 'bg-yellow-500',
    IN_PROGRESS: 'bg-orange-500',
    RESOLVED: 'bg-green-500',
    CLOSED: 'bg-gray-500',
  };
  return colorMap[status] || 'bg-gray-500';
}

/**
 * Get priority color class for Tailwind
 */
export function getPriorityColorClass(priority: IncidentPriority): string {
  const colorMap: Record<IncidentPriority, string> = {
    P1: 'bg-red-500',
    P2: 'bg-orange-500',
    P3: 'bg-yellow-500',
    P4: 'bg-blue-500',
  };
  return colorMap[priority] || 'bg-gray-500';
}

/**
 * Get status text color class with theme-aware background and border
 */
export function getStatusTextColorClass(status: IncidentStatus): string {
  const colorMap: Record<IncidentStatus, string> = {
    OPEN: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800',
    ACKNOWLEDGED: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800',
    IN_PROGRESS: 'text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800',
    RESOLVED: 'text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800',
    CLOSED: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
  };
  return colorMap[status] || 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700';
}

/**
 * Get priority text color class with theme-aware background and border
 */
export function getPriorityTextColorClass(priority: IncidentPriority): string {
  const colorMap: Record<IncidentPriority, string> = {
    P1: 'text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800',
    P2: 'text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800',
    P3: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800',
    P4: 'text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800',
  };
  return colorMap[priority] || 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700';
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format date to full datetime string
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Check if incident is in active state (not resolved or closed)
 */
export function isIncidentActive(incident: Incident): boolean {
  return incident.status !== 'RESOLVED' && incident.status !== 'CLOSED';
}

/**
 * Check if incident is resolved
 */
export function isIncidentResolved(incident: Incident): boolean {
  return incident.status === 'RESOLVED' || incident.status === 'CLOSED';
}

/**
 * Get valid status transitions from current status
 * Based on typical incident lifecycle
 */
export function getValidStatusTransitions(currentStatus: IncidentStatus): IncidentStatus[] {
  const transitions: Record<IncidentStatus, IncidentStatus[]> = {
    OPEN: ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    ACKNOWLEDGED: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'],
    RESOLVED: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
    CLOSED: ['OPEN', 'IN_PROGRESS'],
  };
  return transitions[currentStatus] || [];
}

/**
 * Sort incidents by priority (P1 first)
 */
export function sortByPriority(incidents: Incident[]): Incident[] {
  const priorityOrder: Record<IncidentPriority, number> = {
    P1: 0,
    P2: 1,
    P3: 2,
    P4: 3,
  };

  return [...incidents].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Sort incidents by status (active first)
 */
export function sortByStatus(incidents: Incident[]): Incident[] {
  const statusOrder: Record<IncidentStatus, number> = {
    OPEN: 0,
    ACKNOWLEDGED: 1,
    IN_PROGRESS: 2,
    RESOLVED: 3,
    CLOSED: 4,
  };

  return [...incidents].sort((a, b) => {
    return statusOrder[a.status] - statusOrder[b.status];
  });
}

/**
 * Extract incident number for display
 */
export function getIncidentNumberDisplay(incident: Incident): string {
  return incident.incident_number;
}

/**
 * Get incident title with fallback
 */
export function getIncidentTitle(incident: Incident): string {
  return incident.title || 'Untitled Incident';
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Build filter query string from filter object
 */
export function buildFilterQueryString(filters: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });

  return params.toString();
}
