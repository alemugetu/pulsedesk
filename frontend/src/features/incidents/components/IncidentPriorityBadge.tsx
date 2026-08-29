/**
 * IncidentPriorityBadge component.
 * 
 * Displays incident priority with appropriate styling.
 * Uses color and text for accessibility (not color alone).
 */

import type { IncidentPriority } from '../types/incident.types';
import { getPriorityDisplayText, getPriorityTextColorClass } from '../utils/incidentUtils';

interface IncidentPriorityBadgeProps {
  priority: IncidentPriority;
  className?: string;
}

export function IncidentPriorityBadge({ priority, className = '' }: IncidentPriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityTextColorClass(priority)} ${className}`}
      role="status"
      aria-label={`Priority: ${getPriorityDisplayText(priority)}`}
    >
      {getPriorityDisplayText(priority)}
    </span>
  );
}
