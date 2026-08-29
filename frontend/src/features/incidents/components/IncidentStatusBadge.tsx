/**
 * IncidentStatusBadge component.
 * 
 * Displays incident status with appropriate styling.
 * Uses color and text for accessibility (not color alone).
 */

import type { IncidentStatus } from '../types/incident.types';
import { getStatusDisplayText, getStatusTextColorClass } from '../utils/incidentUtils';

interface IncidentStatusBadgeProps {
  status: IncidentStatus;
  className?: string;
}

export function IncidentStatusBadge({ status, className = '' }: IncidentStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusTextColorClass(status)} ${className}`}
      role="status"
      aria-label={`Status: ${getStatusDisplayText(status)}`}
    >
      {getStatusDisplayText(status)}
    </span>
  );
}
