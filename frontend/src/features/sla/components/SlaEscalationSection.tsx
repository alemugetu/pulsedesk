/**
 * SlaEscalationSection component.
 * 
 * Integrates SLA and escalation information for incident detail.
 * Consumes current incident, incident SLA data, escalation data, organization context, and existing permissions.
 * The existing Incident Detail page must continue to display all existing functionality.
 * Phase 13.8 adds SLA/Escalation functionality without breaking Phase 13.7.
 */

import type { Incident } from '../../incidents/types/incident.types';
import { useIncidentSla } from '../hooks/useIncidentSla';
import { getIncidentEscalations } from '../services/escalationService';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';
import { SlaSummaryCard } from './SlaSummaryCard';
import { EscalationStatusBadge } from './EscalationStatusBadge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { ErrorState } from '../../../components/ui/ErrorState';


interface SlaEscalationSectionProps {
  incident: Incident;
  className?: string;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SlaEscalationSection({ incident, className = '' }: SlaEscalationSectionProps) {
  const { currentOrganization: organization, hasPermission } = useOrganizationContext();
  const sla = useIncidentSla(incident);

  // Fetch incident escalation history
  const {
    data: escalations,
    isLoading: isLoadingEscalations,
    error: escalationError,
    refetch,
  } = useQuery({
    queryKey: ['incident-escalations', organization?.id, incident.id],
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      return getIncidentEscalations(organization.id, incident.id);
    },
    enabled: !!organization?.id && !!incident.id && hasPermission('escalation.view'),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* SLA Status Section */}
      <SlaSummaryCard sla={sla} />

      {/* Escalation History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Escalation History</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasPermission('escalation.view') ? (
            <p className="text-sm text-muted-foreground">
              You do not have permission to view escalation history.
            </p>
          ) : isLoadingEscalations ? (
            <div className="flex justify-center py-8">
              <Loading size="md" />
            </div>
          ) : escalationError ? (
            <ErrorState
              title="Failed to load escalation history"
              description={escalationError instanceof Error ? escalationError.message : 'An error occurred'}
              onRetry={() => void refetch()}
            />
          ) : !escalations || escalations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No escalation history for this incident.
            </p>
          ) : (
            <div className="space-y-4">
              {escalations.map((escalation) => (
                <div key={escalation.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{escalation.policy}</p>
                      <p className="text-xs text-muted-foreground">{escalation.trigger_type}</p>
                    </div>
                    <EscalationStatusBadge status={escalation.status} />
                  </div>

                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Current Level: </span>
                      <span className="font-medium">{escalation.current_level}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Started: </span>
                      <span className="font-medium">{formatDate(escalation.started_at)}</span>
                    </div>
                    {escalation.last_evaluated_at && (
                      <div>
                        <span className="text-muted-foreground">Last Evaluated: </span>
                        <span className="font-medium">{formatDate(escalation.last_evaluated_at)}</span>
                      </div>
                    )}
                    {escalation.completed_at && (
                      <div>
                        <span className="text-muted-foreground">Completed: </span>
                        <span className="font-medium">{formatDate(escalation.completed_at)}</span>
                      </div>
                    )}
                  </div>

                  {escalation.events && escalation.events.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Escalation Events:</p>
                      <div className="space-y-2">
                        {escalation.events.map((event) => (
                          <div key={event.id} className="text-sm bg-muted p-2 rounded">
                            <div className="flex justify-between">
                              <span className="font-medium">Level {event.level}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(event.triggered_at)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Target: {event.target_type}
                              {event.target_reference && ` (${event.target_reference})`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
