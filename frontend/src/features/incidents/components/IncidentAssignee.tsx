/**
 * IncidentAssignee component.
 * 
 * Displays incident assignee information.
 */

import type { AssigneeReference } from '../types/incident.types';
import { User } from 'lucide-react';

interface IncidentAssigneeProps {
  assignee: AssigneeReference | null;
  className?: string;
}

export function IncidentAssignee({ assignee, className = '' }: IncidentAssigneeProps) {
  if (!assignee) {
    return (
      <div className={`flex items-center text-sm text-muted-foreground ${className}`}>
        <User className="w-4 h-4 mr-1.5" />
        <span>Unassigned</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center text-sm ${className}`}>
      <User className="w-4 h-4 mr-1.5 text-muted-foreground" />
      <span className="font-medium">{assignee.user.email}</span>
    </div>
  );
}
