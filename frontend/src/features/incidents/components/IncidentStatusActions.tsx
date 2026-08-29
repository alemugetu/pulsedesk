/**
 * IncidentStatusActions component.
 * 
 * Provides status transition actions for an incident.
 * Shows only valid transitions based on current status.
 */

import type { Incident, IncidentStatus } from '../types/incident.types';
import { getValidStatusTransitions, getStatusDisplayText } from '../utils/incidentUtils';
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
  
  const validTransitions = getValidStatusTransitions(incident.status);
  const canUpdateIncident = hasPermission('incident.update');

  const handleStatusTransition = async (newStatus: IncidentStatus) => {
    try {
      await updateIncidentAsync({
        incidentId: incident.id,
        data: { status: newStatus },
      });
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update incident status:', error);
    }
  };

  if (!canUpdateIncident || validTransitions.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {validTransitions.map((status) => (
        <Button
          key={status}
          variant="outline"
          size="sm"
          onClick={() => handleStatusTransition(status)}
          disabled={isLoading}
          aria-label={`Change status to ${getStatusDisplayText(status)}`}
        >
          {getStatusDisplayText(status)}
        </Button>
      ))}
    </div>
  );
}
