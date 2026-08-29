/**
 * SlaPolicyCard component.
 * 
 * Displays SLA policy information including targets.
 * Used in policy lists and detail views.
 */

import type { SLAPolicy } from '../types/sla.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

interface SlaPolicyCardProps {
  policy: SLAPolicy;
  className?: string;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SlaPolicyCard({ policy, className = '' }: SlaPolicyCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{policy.name}</CardTitle>
            {policy.description && (
              <CardDescription className="mt-1">{policy.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            {policy.is_default && (
              <Badge variant="secondary">Default</Badge>
            )}
            {!policy.is_active && (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Targets: </span>
            <span className="font-medium">{policy.targets.length}</span>
          </div>
          
          {policy.targets.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Priority Targets:</p>
              <div className="space-y-1">
                {policy.targets.map((target) => (
                  <div key={target.id} className="text-sm flex justify-between">
                    <span className="text-muted-foreground">{target.priority}</span>
                    <span className="font-medium">
                      Response: {target.response_time_minutes}m | 
                      Resolution: {target.resolution_time_minutes}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-2 border-t">
            Created: {formatDate(policy.created_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
