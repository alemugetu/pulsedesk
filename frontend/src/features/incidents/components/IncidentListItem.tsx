/**
 * IncidentListItem component.
 * 
 * Displays a single incident in the list view.
 * Shows key information: title, status, priority, category, assignee, timestamps.
 */

import type { Incident } from '../types/incident.types';
import { IncidentStatusBadge } from './IncidentStatusBadge';
import { IncidentPriorityBadge } from './IncidentPriorityBadge';
import { IncidentCategory } from './IncidentCategory';
import { IncidentAssignee } from './IncidentAssignee';
import { formatDate } from '../utils/incidentUtils';
import { ChevronRight } from 'lucide-react';

interface IncidentListItemProps {
  incident: Incident;
  onClick: () => void;
  className?: string;
}

export function IncidentListItem({ incident, onClick, className = '' }: IncidentListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors ${className}`}
      aria-label={`View incident ${incident.incident_number}: ${incident.title}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-muted-foreground">
              {incident.incident_number}
            </span>
            <IncidentStatusBadge status={incident.status} />
            <IncidentPriorityBadge priority={incident.priority} />
          </div>
          
          <h3 className="text-base font-semibold text-foreground mb-1 truncate">
            {incident.title}
          </h3>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <IncidentCategory category={incident.category} />
            <IncidentAssignee assignee={incident.assignee} />
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDate(incident.created_at)}
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
