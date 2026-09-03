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
      const msg = error instanceof Error ? error.message : 'Failed to update incident status';
      setTransitionError(msg);
    } finally {
      setActiveTarget(null);
    }
  };

  const handleActionClick = (targetStatus: IncidentStatus) => {
    setTransitionError(null);
    // For terminal or critical transitions (RESOLVED, CLOSED), require explicit operator confirmation
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
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span>You do not have permission to transition this incident from {getStatusDisplayText(incident.status)}.</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {transitionError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{transitionError}</span>
        </div>
      )}

      {confirmStatus ? (
        <div
          role="alertdialog"
          aria-labelledby="confirm-transition-title"
          className="p-4 rounded-xl border border-border bg-card space-y-3"
        >
          <p id="confirm-transition-title" className="text-sm font-semibold text-foreground">
            Confirm transition to {getStatusDisplayText(confirmStatus)}?
          </p>
          <p className="text-xs text-muted-foreground">
            {confirmStatus === 'RESOLVED'
              ? 'Marking as resolved records resolution timestamp and completes SLA resolution tracking.'
              : 'Closing an incident finalizes the record. No further operational status changes can be made.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={isLoading}
              onClick={() => handleExecuteTransition(confirmStatus)}
            >
              {isLoading && activeTarget === confirmStatus ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Updating...
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
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {permittedTransitions.map((targetStatus) => {
            const isAcknowledge = targetStatus === 'ACKNOWLEDGED';
            const isResolve = targetStatus === 'RESOLVED';
            const isTargetBusy = isLoading && activeTarget === targetStatus;

            return (
              <Button
                key={targetStatus}
                variant={isAcknowledge ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleActionClick(targetStatus)}
                disabled={isLoading}
                aria-label={`Change status to ${getStatusDisplayText(targetStatus)}`}
                className={isAcknowledge ? 'shadow-sm' : ''}
              >
                {isTargetBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isAcknowledge ? (
                  <CheckCircle2 className="h-4 w-4 mr-2 text-primary-foreground" />
                ) : isResolve ? (
                  <CheckCheck className="h-4 w-4 mr-2 text-emerald-500" />
                ) : targetStatus === 'IN_PROGRESS' ? (
                  <Play className="h-4 w-4 mr-2 text-blue-500" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {isTargetBusy ? 'Updating...' : getStatusDisplayText(targetStatus)}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
