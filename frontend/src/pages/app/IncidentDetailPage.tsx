/**
 * IncidentDetailPage component.
 * 
 * Page for viewing and managing a single incident.
 * Displays full incident details with status actions.
 */

import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useIncident } from '../../features/incidents/hooks/useIncident';
import { IncidentDetail } from '../../features/incidents/components/IncidentDetail';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Edit } from 'lucide-react';
import { useCurrentOrganization } from '../../features/organizations/context/organizationContextDef';

export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const organization = useCurrentOrganization();
  
  const { data: incident, isLoading, error } = useIncident(incidentId || null);
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  const handleBack = () => {
    navigate('/app/incidents');
  };

  const handleEdit = () => {
    if (incidentId) {
      navigate(`/app/incidents/${incidentId}/edit`);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    // The status change is handled by the IncidentStatusActions component
    // This callback is for any additional UI updates needed
    console.log('Status changed to:', newStatus);
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization to view incidents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Incident Details</h1>
            <p className="text-muted-foreground">View and manage incident information</p>
          </div>
        </div>
        {/* Edit functionality not yet implemented */}
      </div>

      <IncidentDetail
        incident={incident || null}
        isLoading={isLoading}
        error={errorMessage || null}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
