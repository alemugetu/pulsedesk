/**
 * CreateIncidentPage component.
 * 
 * Page for creating a new incident.
 * Uses IncidentForm for the form interface.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateIncident } from '../../features/incidents/hooks/useCreateIncident';
import { IncidentForm } from '../../features/incidents/components/IncidentForm';
import { Button } from '../../components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { useCurrentOrganization } from '../../features/organizations/context/organizationContextDef';
import type { CreateIncidentRequest, UpdateIncidentRequest } from '../../features/incidents/types/incident.types';

export function CreateIncidentPage() {
  const navigate = useNavigate();
  const organization = useCurrentOrganization();
  const { createIncidentAsync, isLoading } = useCreateIncident();
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    navigate('/app/incidents');
  };

  const handleSubmit = async (data: CreateIncidentRequest | UpdateIncidentRequest) => {
    try {
      setError(null);
      // Title is always present from the form, but guard for type safety
      if (!data.title) {
        setError('Incident title is required');
        return;
      }
      // For create incident, we only use CreateIncidentRequest fields
      const createData: CreateIncidentRequest = {
        title: data.title,
        description: data.description,
        priority: data.priority,
      };
      
      console.log('Creating incident with data:', createData);
      console.log('Organization:', organization);
      
      const incident = await createIncidentAsync(createData);
      
      console.log('Incident created successfully:', incident);
      
      // Navigate to the new incident detail page
      navigate(`/app/incidents/${incident.id}`);
    } catch (err) {
      console.error('Failed to create incident:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create incident';
      setError(errorMessage);
    }
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization to create incidents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Incident</h1>
          <p className="text-muted-foreground">Report a new operational incident</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500 text-red-500">
          {error}
        </div>
      )}

      <div className="max-w-2xl">
        <IncidentForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onCancel={handleBack}
          submitLabel="Create Incident"
        />
      </div>
    </div>
  );
}

