/**
 * IncidentDetail component.
 * 
 * Displays full incident details including header, metadata, and actions.
 */

import type { Incident } from '../types/incident.types';
import { IncidentHeader } from './IncidentHeader';
import { IncidentMetadata } from './IncidentMetadata';
import { IncidentStatusActions } from './IncidentStatusActions';
import { Loading } from '../../../components/ui/Loading';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Card } from '../../../components/ui/Card';
import { CollaborationSection } from '../../collaboration/components/CollaborationSection';

interface IncidentDetailProps {
  incident: Incident | null;
  isLoading: boolean;
  error: string | null;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

export function IncidentDetail({
  incident,
  isLoading,
  error,
  onStatusChange,
  className = '',
}: IncidentDetailProps) {
  if (isLoading) {
    return (
      <div className={`flex justify-center py-12 ${className}`}>
        <Loading size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`py-12 ${className}`}>
        <ErrorState
          title="Failed to load incident"
          description={error}
        />
      </div>
    );
  }

  if (!incident) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6">
        <IncidentHeader incident={incident} />
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {incident.description || 'No description provided.'}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Details</h2>
          <IncidentMetadata incident={incident} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Status Actions</h2>
          <IncidentStatusActions
            incident={incident}
            onStatusChange={onStatusChange}
          />
        </div>
      </Card>

      <CollaborationSection incidentId={incident.id} />
    </div>
  );
}
