/**
 * IncidentAssignee component.
 * 
 * Displays incident assignee information with avatar and operational status.
 * Provides accessible Reassign/Assign button for authorized operators (requires incident.assign).
 */

import { useState } from 'react';
import { UserCheck, UserX, UserPlus, ArrowRightLeft } from 'lucide-react';
import type { AssigneeReference } from '../types/incident.types';
import { Button } from '../../../components/ui/Button';
import { useOptionalOrganizationContext } from '../../organizations/context/organizationContextDef';
import { IncidentAssigneeModal } from './IncidentAssigneeModal';

interface IncidentAssigneeProps {
  assignee: AssigneeReference | null;
  incidentId?: string;
  isClosed?: boolean;
  onAssigned?: (assigneeId: string | null) => void;
  className?: string;
}

function getInitials(email: string): string {
  if (!email) return 'UN';
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

export function IncidentAssignee({
  assignee,
  incidentId,
  isClosed = false,
  onAssigned,
  className = '',
}: IncidentAssigneeProps) {
  const orgContext = useOptionalOrganizationContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canAssign = Boolean(orgContext?.hasPermission('incident.assign') && !isClosed && incidentId);

  return (
    <>
      <div className={`flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {assignee ? (
            <>
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                {getInitials(assignee.user.email)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {assignee.user.email}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground block">Assigned Engineer</span>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                <UserX className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground block">
                  Unassigned
                </span>
                <span className="text-xs text-muted-foreground block">In Organization Triage Pool</span>
              </div>
            </>
          )}
        </div>

        {canAssign && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 text-xs h-8 gap-1.5 border-border hover:bg-accent"
            aria-label={assignee ? 'Reassign incident to another member' : 'Assign incident to member'}
          >
            {assignee ? (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Reassign</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Assign</span>
              </>
            )}
          </Button>
        )}
      </div>

      {incidentId && (
        <IncidentAssigneeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          incidentId={incidentId}
          currentAssigneeId={assignee?.id ?? null}
          onAssigned={onAssigned}
        />
      )}
    </>
  );
}
