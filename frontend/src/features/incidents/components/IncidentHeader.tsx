/**
 * IncidentHeader component.
 * 
 * Displays incident header with title, number, status, and priority.
 */

import type { Incident } from '../types/incident.types';
import { IncidentStatusBadge } from './IncidentStatusBadge';
import { IncidentPriorityBadge } from './IncidentPriorityBadge';

interface IncidentHeaderProps {
  incident: Incident;
  className?: string;
}

export function IncidentHeader({ incident, className = '' }: IncidentHeaderProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-muted-foreground">
              {incident.incident_number}
            </span>
            <IncidentStatusBadge status={incident.status} />
            <IncidentPriorityBadge priority={incident.priority} />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground">
            {incident.title}
          </h1>
        </div>
      </div>
    </div>
  );
}
