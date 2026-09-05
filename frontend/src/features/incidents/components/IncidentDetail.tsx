/**
 * IncidentDetail component.
 * 
 * Enterprise operational layout for an incident:
 * - Desktop: 2-column layout (Operational Sidebar + Main Workspace)
 * - Mobile/Tablet: Fluid responsive stacked layout
 * - Status Actions with lifecycle permissions
 * - Interactive Assignee card with Reassign modal
 * - Visual Lifecycle Progression Stepper
 * - Integrated SLA Targets and Escalation Monitoring
 * - Collaboration Hub (Comments & Attachments)
 */

import type { Incident } from '../types/incident.types';
import { IncidentHeader } from './IncidentHeader';
import { IncidentStatusStepper } from './IncidentStatusStepper';
import { IncidentMetadata } from './IncidentMetadata';
import { IncidentStatusActions } from './IncidentStatusActions';
import { IncidentAssignee } from './IncidentAssignee';
import { Loading } from '../../../components/ui/Loading';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Card } from '../../../components/ui/Card';
import { CollaborationSection } from '../../collaboration/components/CollaborationSection';
import { SlaEscalationSection } from '../../sla/components/SlaEscalationSection';

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
      <div className={`flex flex-col items-center justify-center py-20 ${className}`}>
        <Loading size="lg" />
        <p className="text-sm text-muted-foreground mt-3">Loading incident details...</p>
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

  const isClosed = incident.status === 'CLOSED';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card */}
      <Card className="p-6 shadow-sm border-border bg-card">
        <IncidentHeader incident={incident} />
        
        {/* Lifecycle Stepper */}
        <div className="mt-6 pt-5 border-t border-border/60">
          <IncidentStatusStepper
            currentStatus={incident.status}
            createdAt={incident.created_at}
            resolvedAt={incident.resolved_at}
          />
        </div>
      </Card>

      {/* Main Grid: 2 Columns on Desktop, Stacked on Mobile/Tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols): Description & Collaboration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <Card className="p-6 shadow-sm border-border bg-card">
            <h2 className="text-base font-semibold text-foreground mb-3">Incident Summary & Description</h2>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/50">
              {incident.description || 'No detailed incident description provided.'}
            </div>
          </Card>

          {/* Collaboration Section (Comments & Attachments) */}
          <div className="space-y-2">
            <CollaborationSection incidentId={incident.id} />
          </div>
        </div>

        {/* Right Column (1 Col): Operational Sidebar */}
        <div className="space-y-6">
          {/* Status Actions Card */}
          <Card className="p-5 shadow-sm border-border bg-card">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3.5">
              Status Actions
            </h2>
            <IncidentStatusActions
              incident={incident}
              onStatusChange={onStatusChange}
            />
          </Card>

          {/* Assignee Card */}
          <Card className="p-5 shadow-sm border-border bg-card">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3.5">
              Incident Assignment
            </h2>
            <IncidentAssignee
              assignee={incident.assignee}
              incidentId={incident.id}
              isClosed={isClosed}
            />
          </Card>

          {/* SLA & Escalation Section */}
          <SlaEscalationSection incident={incident} />

          {/* Metadata Card */}
          <Card className="p-5 shadow-sm border-border bg-card">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3.5">
              Incident Details
            </h2>
            <IncidentMetadata incident={incident} />
          </Card>
        </div>
      </div>
    </div>
  );
}
