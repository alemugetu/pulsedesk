/**
 * IncidentList component.
 * 
 * Displays a list of incidents with loading, empty, and error states.
 * Integrates with search, filters, and pagination.
 */

import type { Incident } from '../types/incident.types';
import { IncidentListItem } from './IncidentListItem';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';

interface IncidentListProps {
  incidents: Incident[];
  isLoading: boolean;
  error: string | null;
  onIncidentClick: (incident: Incident) => void;
  className?: string;
}

export function IncidentList({
  incidents,
  isLoading,
  error,
  onIncidentClick,
  className = '',
}: IncidentListProps) {
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
          title="Failed to load incidents"
          description={error}
        />
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className={`py-12 ${className}`}>
        <EmptyState
          title="No incidents found"
          description="There are no incidents matching your current filters."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {incidents.map((incident) => (
        <IncidentListItem
          key={incident.id}
          incident={incident}
          onClick={() => onIncidentClick(incident)}
        />
      ))}
    </div>
  );
}
