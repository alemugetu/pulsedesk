/**
 * SlaSummaryCard component.
 * 
 * Provides a concise incident SLA summary.
 * Shows only data available from the backend.
 * Handles cases where SLA data is not available.
 */

import type { IncidentSLASummary } from '../types/sla.types';
import { SlaStatusBadge } from './SlaStatusBadge';
import { SlaProgress } from './SlaProgress';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';

interface SlaSummaryCardProps {
  sla: IncidentSLASummary | null;
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

export function SlaSummaryCard({ sla, className = '' }: SlaSummaryCardProps) {
  if (!sla) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">SLA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No SLA policy is configured for this incident.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">SLA Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Policy</p>
            <p className="font-medium">{sla.policy}</p>
          </div>
          <SlaStatusBadge status={sla.response_status} />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Response Deadline</p>
            <p className="text-sm font-medium">{formatDate(sla.response_deadline)}</p>
            <SlaProgress
              deadline={sla.response_deadline}
              completedAt={sla.response_completed_at}
              status={sla.response_status}
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Resolution Deadline</p>
            <p className="text-sm font-medium">{formatDate(sla.resolution_deadline)}</p>
            <SlaProgress
              deadline={sla.resolution_deadline}
              completedAt={sla.resolution_completed_at}
              status={sla.resolution_status}
            />
          </div>
        </div>

        {sla.response_completed_at && (
          <div className="text-sm">
            <span className="text-muted-foreground">Response completed at: </span>
            <span className="font-medium">{formatDate(sla.response_completed_at)}</span>
          </div>
        )}

        {sla.resolution_completed_at && (
          <div className="text-sm">
            <span className="text-muted-foreground">Resolution completed at: </span>
            <span className="font-medium">{formatDate(sla.resolution_completed_at)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
