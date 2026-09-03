/**
 * CreateIncidentPage component.
 * 
 * Operational workflow page for creating a new incident.
 * Coordinates:
 * - Incident validation and creation
 * - Staged attachments upload
 * - Progress indicator
 * - Error handling and success navigation
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateIncident } from '../../features/incidents/hooks/useCreateIncident';
import { IncidentForm } from '../../features/incidents/components/IncidentForm';
import { Button } from '../../components/ui/Button';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { uploadAttachment } from '../../features/collaboration/services/attachmentService';
import type { CreateIncidentRequest, UpdateIncidentRequest } from '../../features/incidents/types/incident.types';

export function CreateIncidentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrganization: organization, hasPermission } = useOrganizationContext();
  const { createIncidentAsync, isLoading: isCreating } = useCreateIncident();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission('incident.create');

  const handleBack = () => {
    navigate('/app/incidents');
  };

  const handleSubmit = async (
    data: CreateIncidentRequest | UpdateIncidentRequest,
    stagedFiles?: File[]
  ) => {
    if (!organization?.id) {
      setError('An active organization is required to create incidents.');
      return;
    }

    if (!canCreate) {
      setError('You do not have permission to create incidents in this organization.');
      return;
    }

    try {
      setError(null);

      if (!data.title?.trim()) {
        setError('Incident title is required.');
        return;
      }

      const createData: CreateIncidentRequest = {
        title: data.title.trim(),
        description: data.description?.trim() || '',
        priority: data.priority,
        category_id: data.category_id || null,
        assignee_id: data.assignee_id || null,
      };

      setUploadProgressText('Creating incident record...');
      const incident = await createIncidentAsync(createData);

      // Upload staged attachments if any
      if (stagedFiles && stagedFiles.length > 0) {
        setIsUploading(true);
        const total = stagedFiles.length;
        let successCount = 0;
        const uploadErrors: string[] = [];

        for (let i = 0; i < total; i++) {
          const file = stagedFiles[i];
          setUploadProgressText(`Uploading attachment ${i + 1} of ${total}: ${file.name}...`);
          try {
            await uploadAttachment(organization.id, incident.id, file);
            successCount++;
          } catch (uploadErr) {
            const msg = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
            uploadErrors.push(`${file.name}: ${msg}`);
          }
        }

        if (uploadErrors.length > 0) {
          console.warn(`Incident created with ${successCount}/${total} attachments. Warnings:`, uploadErrors);
        }
      }

      // Invalidate queries so incident lists and detail view reflect latest data immediately
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      // Navigate to newly created incident detail page
      navigate(`/app/incidents/${incident.id}`);
    } catch (err) {
      console.error('Failed to create incident:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create incident';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgressText(null);
    }
  };

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <p className="text-muted-foreground">Please select an organization to report and manage incidents.</p>
        <Button onClick={() => navigate('/app/organizations')}>Go to Organizations</Button>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Incidents
        </Button>
        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 border rounded-xl p-8 bg-card">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold text-foreground">Permission Denied</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            You do not have permission to create incidents in {organization.name}. Contact your organization administrator to request the &quot;incident.create&quot; permission.
          </p>
          <Button variant="outline" onClick={handleBack}>Return to Incidents</Button>
        </div>
      </div>
    );
  }

  const isBusy = isCreating || isUploading;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} disabled={isBusy}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Incidents
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Report New Incident</h1>
            <p className="text-sm text-muted-foreground">
              Define operational classification, assignment, and escalation in {organization.name}
            </p>
          </div>
        </div>

        {uploadProgressText && (
          <div className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{uploadProgressText}</span>
          </div>
        )}
      </div>

      {/* API / Submission Error */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Unable to submit incident</p>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Operational Form */}
      <IncidentForm
        onSubmit={handleSubmit}
        isLoading={isBusy}
        onCancel={handleBack}
        submitLabel={isBusy ? 'Submitting Incident...' : 'Create Incident'}
      />
    </div>
  );
}
