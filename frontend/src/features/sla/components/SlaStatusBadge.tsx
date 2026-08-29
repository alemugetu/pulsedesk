/**
 * SlaStatusBadge component.
 * 
 * Displays SLA status with appropriate styling.
 * Uses color and text for accessibility (not color alone).
 * Based on backend SLAStatus: ON_TRACK, BREACHED, COMPLETED
 */

import type { SLAStatus } from '../types/sla.types';

interface SlaStatusBadgeProps {
  status: SLAStatus;
  className?: string;
}

/**
 * Get display text for SLA status
 */
function getSlaStatusDisplayText(status: SLAStatus): string {
  switch (status) {
    case 'ON_TRACK':
      return 'On Track';
    case 'BREACHED':
      return 'Breached';
    case 'COMPLETED':
      return 'Completed';
    default:
      return 'Unknown';
  }
}

/**
 * Get color class for SLA status
 */
function getSlaStatusColorClass(status: SLAStatus): string {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-green-500 text-white';
    case 'BREACHED':
      return 'bg-red-500 text-white';
    case 'COMPLETED':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

export function SlaStatusBadge({ status, className = '' }: SlaStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSlaStatusColorClass(status)} ${className}`}
      role="status"
      aria-label={`SLA Status: ${getSlaStatusDisplayText(status)}`}
    >
      {getSlaStatusDisplayText(status)}
    </span>
  );
}
