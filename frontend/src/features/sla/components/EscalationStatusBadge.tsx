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
      return 'bg-yellow-500 text-white';
    case 'COMPLETED':
      return 'bg-green-500 text-white';
    case 'CANCELLED':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-500 text-white';
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
