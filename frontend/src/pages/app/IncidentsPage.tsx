/**
 * IncidentsPage component.
 * 
 * Main page for incident management.
 * Displays incident list with search, filters, and pagination.
 */

import { useNavigate } from 'react-router-dom';
import { useIncidents } from '../../features/incidents/hooks/useIncidents';
import { useIncidentFilters } from '../../features/incidents/hooks/useIncidentFilters';
import { IncidentList } from '../../features/incidents/components/IncidentList';
import { IncidentSearch } from '../../features/incidents/components/IncidentSearch';
import { IncidentFilters } from '../../features/incidents/components/IncidentFilters';
import { IncidentPagination } from '../../features/incidents/components/IncidentPagination';
import { Button } from '../../components/ui/Button';
import { Plus } from 'lucide-react';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import type { Incident } from '../../features/incidents/types/incident.types';

export function IncidentsPage() {
  const navigate = useNavigate();
  const { currentOrganization: organization, hasPermission } = useOrganizationContext();
  const { filters, setFilter, clearFilters, hasActiveFilters } = useIncidentFilters();
  
  const { data, isLoading, error } = useIncidents(filters);
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  
  const handleIncidentClick = (incident: Incident) => {
    navigate(`/app/incidents/${incident.id}`);
  };

  const handleCreateIncident = () => {
    navigate('/app/incidents/new');
  };

  const handlePageChange = (page: number) => {
    setFilter('page', page);
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization to view incidents.</p>
      </div>
    );
  }

  const canCreateIncident = hasPermission('incident.create');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-muted-foreground">Manage and track operational incidents</p>
        </div>
        {canCreateIncident && (
          <Button onClick={handleCreateIncident}>
            <Plus className="w-4 h-4 mr-2" />
            New Incident
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <IncidentSearch
              value={filters.search || ''}
              onChange={(value) => setFilter('search', value)}
            />
          </div>
        </div>

        <IncidentFilters
          status={filters.status}
          priority={filters.priority}
          assignee={filters.assignee}
          category={filters.category}
          onStatusChange={(value) => setFilter('status', value)}
          onPriorityChange={(value) => setFilter('priority', value)}
          onAssigneeChange={(value) => setFilter('assignee', value)}
          onCategoryChange={(value) => setFilter('category', value)}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <IncidentList
        incidents={data?.results || []}
        isLoading={isLoading}
        error={errorMessage || null}
        onIncidentClick={handleIncidentClick}
      />

      {data?.meta && (
        <IncidentPagination
          meta={data.meta}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

