/**
 * IncidentStatusActions component.
 * 
 * Provides operational status transition actions for an incident.
 * Strict adherence to backend ALLOWED_TRANSITIONS and REQUIRED_PERMISSIONS_FOR_STATUS:
 * - OPEN → ACKNOWLEDGED (requires incident.update)
 * - ACKNOWLEDGED → IN_PROGRESS (requires incident.update)
 * - IN_PROGRESS → RESOLVED (requires incident.resolve)
 * - RESOLVED → CLOSED (requires incident.close)
 * - CLOSED (terminal state)
 */

import { useState } from 'react';
import { CheckCircle2, Play, CheckCheck, Lock, AlertCircle, Loader2 } from 'lucide-react';
import type { Incident, IncidentStatus } from '../types/incident.types';
import {
  getValidStatusTransitions,
  getRequiredPermissionForStatus,
  getStatusDisplayText,
} from '../utils/incidentUtils';
import { Button } from '../../../components/ui/Button';
import { useUpdateIncident } from '../hooks/useUpdateIncident';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';

interface IncidentStatusActionsProps {
  incident: Incident;
  onStatusChange?: (newStatus: IncidentStatus) => void;
  className?: string;
}

function getProgressMessage(status: IncidentStatus): string {
  switch (status) {
    case 'ACKNOWLEDGED':
      return 'Acknowledging...';
    case 'IN_PROGRESS':
      return 'Starting work...';
    case 'RESOLVED':
      return 'Resolving incident...';
    case 'CLOSED':
      return 'Closing incident...';
    default:
      return 'Updating status...';
  }
}

export function IncidentStatusActions({ 
  incident, 
  onStatusChange,
  className = '' 
}: IncidentStatusActionsProps) {
  const { hasPermission } = useOrganizationContext();
  const { updateIncidentAsync, isLoading } = useUpdateIncident();
  
  const [confirmStatus, setConfirmStatus] = useState<IncidentStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<IncidentStatus | null>(null);

  const rawTransitions = getValidStatusTransitions(incident.status);

  // Filter transitions where user has the required permission
  const permittedTransitions = rawTransitions.filter((targetStatus) => {
    const requiredPerm = getRequiredPermissionForStatus(targetStatus);
    return hasPermission(requiredPerm);
  });

  const handleExecuteTransition = async (newStatus: IncidentStatus) => {
    setTransitionError(null);
    setActiveTarget(newStatus);
    try {
      await updateIncidentAsync({
        incidentId: incident.id,
        data: { status: newStatus },
      });
      setConfirmStatus(null);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update incident status:', error);
      const msg = error instanceof Error ? error.message : 'Failed to update incident status.';
      setTransitionError(msg);
    } finally {
      setActiveTarget(null);
    }
  };

  const handleActionClick = (targetStatus: IncidentStatus) => {
    setTransitionError(null);
    // For critical transitions (RESOLVED, CLOSED), require explicit operator confirmation
    if (targetStatus === 'RESOLVED' || targetStatus === 'CLOSED') {
      setConfirmStatus(targetStatus);
    } else {
      handleExecuteTransition(targetStatus);
    }
  };

  if (rawTransitions.length === 0) {
    return null;
  }

  if (permittedTransitions.length === 0) {
    return (
      <div className={`text-xs text-muted-foreground flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border ${className}`}>
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span>You do not have permission to transition this incident from {getStatusDisplayText(incident.status)}.</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {transitionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{transitionError}</span>
        </div>
      )}

      {confirmStatus ? (
        <div
          role="alertdialog"
          aria-labelledby="confirm-transition-title"
          aria-describedby="confirm-transition-desc"
          className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3"
        >
          <p id="confirm-transition-title" className="text-sm font-semibold text-foreground">
            Confirm transition to {getStatusDisplayText(confirmStatus)}?
          </p>
          <p id="confirm-transition-desc" className="text-xs text-muted-foreground">
            {confirmStatus === 'RESOLVED'
              ? 'Marking as resolved records the resolution timestamp, satisfies resolution SLA tracking, and prepares the incident for review before closure.'
              : 'Closing an incident finalizes the operational record. Once closed, no further status modifications can be made in PulseDesk.'}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="primary"
              disabled={isLoading}
              onClick={() => handleExecuteTransition(confirmStatus)}
              className="gap-1.5 text-xs h-8"
            >
              {isLoading && activeTarget === confirmStatus ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>{getProgressMessage(confirmStatus)}</span>
                </>
              ) : (
                `Confirm ${getStatusDisplayText(confirmStatus)}`
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isLoading}
              onClick={() => setConfirmStatus(null)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {permittedTransitions.map((targetStatus) => {
            const isAcknowledge = targetStatus === 'ACKNOWLEDGED';
            const isResolve = targetStatus === 'RESOLVED';
            const isClose = targetStatus === 'CLOSED';
            const isTargetBusy = isLoading && activeTarget === targetStatus;

            return (
              <Button
                key={targetStatus}
                variant={isAcknowledge ? 'primary' : isResolve ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleActionClick(targetStatus)}
                disabled={isLoading}
                aria-label={`Change status to ${getStatusDisplayText(targetStatus)}`}
                className={`text-xs h-8 gap-1.5 ${
                  isResolve ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                }`}
              >
                {isTargetBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : isAcknowledge ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
                ) : isResolve ? (
                  <CheckCheck className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                ) : targetStatus === 'IN_PROGRESS' ? (
                  <Play className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                ) : isClose ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>
                  {isTargetBusy ? getProgressMessage(targetStatus) : getStatusDisplayText(targetStatus)}
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
