/**
 * IncidentMetadata component.
 * 
 * Displays incident metadata: reporter, assignee, category, timestamps.
 */

import type { Incident } from '../types/incident.types';
import { IncidentCategory } from './IncidentCategory';
import { IncidentAssignee } from './IncidentAssignee';
import { formatDateTime } from '../utils/incidentUtils';
import { Calendar, User } from 'lucide-react';

interface IncidentMetadataProps {
  incident: Incident;
  className?: string;
}

export function IncidentMetadata({ incident, className = '' }: IncidentMetadataProps) {
  return (
    <div className={`space-y-3 text-sm ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <User className="w-4 h-4" />
        <span>Created by: <span className="font-medium text-foreground">{incident.reporter?.email || 'Unknown'}</span></span>
      </div>
      
      <div className="flex items-center gap-2">
        <IncidentAssignee assignee={incident.assignee} />
      </div>
      
      <div className="flex items-center gap-2">
        <IncidentCategory category={incident.category} />
      </div>
      
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>Created: {formatDateTime(incident.created_at)}</span>
      </div>
      
      {incident.updated_at !== incident.created_at && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Updated: {formatDateTime(incident.updated_at)}</span>
        </div>
      )}
      
      {incident.resolved_at && (
        <div className="flex items-center gap-2 text-green-400">
          <Calendar className="w-4 h-4" />
          <span>Resolved: {formatDateTime(incident.resolved_at)}</span>
        </div>
      )}
    </div>
  );
}
