/**
 * IncidentAssignee component.
 * 
 * Displays incident assignee information.
 */

import type { AssigneeReference } from '../types/incident.types';
import { UserCheck } from 'lucide-react';

interface IncidentAssigneeProps {
  assignee: AssigneeReference | null;
  className?: string;
}

export function IncidentAssignee({ assignee, className = '' }: IncidentAssigneeProps) {
  if (!assignee) {
    return (
      <div className={`flex items-center text-sm text-muted-foreground ${className}`}>
        <UserCheck className="w-4 h-4 mr-1.5" />
        <span>Assigned to: <span className="italic">Unassigned (Triage Pool)</span></span>
      </div>
    );
  }

  return (
    <div className={`flex items-center text-sm ${className}`}>
      <UserCheck className="w-4 h-4 mr-1.5 text-primary" />
      <span>
        Assigned to: <span className="font-medium text-foreground">{assignee.user.email}</span>
      </span>
    </div>
  );
}
