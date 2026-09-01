/**
 * EscalationStatusBadge component.
 * 
 * Displays escalation status with appropriate styling.
 * Uses color and text for accessibility (not color alone).
 * Based on backend EscalationStatus: ACTIVE, COMPLETED, CANCELLED
 */

import type { EscalationStatus } from '../types/escalation.types';

interface EscalationStatusBadgeProps {
  status: EscalationStatus;
  className?: string;
}

/**
 * Get display text for escalation status
 */
function getEscalationStatusDisplayText(status: EscalationStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

/**
 * Get color class for escalation status
 */
function getEscalationStatusColorClass(status: EscalationStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700';
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
  }
}

export function EscalationStatusBadge({ status, className = '' }: EscalationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEscalationStatusColorClass(status)} ${className}`}
      role="status"
      aria-label={`Escalation Status: ${getEscalationStatusDisplayText(status)}`}
    >
      {getEscalationStatusDisplayText(status)}
    </span>
  );
}
