/**
 * SlaProgress component.
 * 
 * Displays SLA timing/progress information with visual indicators.
 * Handles loading, active/on-track, breached, completed, and unavailable data states.
 * Uses accessible visual indicators.
 */

import type { SLAStatus } from '../types/sla.types';
import { formatTimeRemaining } from '../hooks/useIncidentSla';

interface SlaProgressProps {
  deadline: string;
  completedAt: string | null;
  status: SLAStatus;
  className?: string;
}

/**
 * Get progress bar color based on SLA status
 */
function getStatusAccentClass(status: SLAStatus): string {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-green-500';
    case 'BREACHED':
      return 'bg-red-500';
    case 'COMPLETED':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

export function SlaProgress({ deadline, completedAt, status, className = '' }: SlaProgressProps) {
  const deadlineDate = new Date(deadline);
  const timeRemaining = formatTimeRemaining(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        SLA timing unavailable
      </div>
    );
  }

  const timingText = status === 'COMPLETED'
    ? `Completed${completedAt ? ` ${new Date(completedAt).toLocaleString()}` : ''}`
    : status === 'BREACHED'
      ? 'Deadline breached'
      : `${timeRemaining} remaining`;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`} role="status">
      <span className={`h-2 w-2 shrink-0 rounded-full ${getStatusAccentClass(status)}`} aria-hidden="true" />
      <span className="text-muted-foreground">{timingText}</span>
    </div>
  );
}
