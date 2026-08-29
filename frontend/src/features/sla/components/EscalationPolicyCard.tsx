/**
 * EscalationPolicyCard component.
 * 
 * Displays escalation policy information including levels and rules.
 * Used in policy lists and detail views.
 */

import type { EscalationPolicy } from '../types/escalation.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { EscalationLevelList } from './EscalationLevelList';

interface EscalationPolicyCardProps {
  policy: EscalationPolicy;
  showLevels?: boolean;
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

export function EscalationPolicyCard({ policy, showLevels = false, className = '' }: EscalationPolicyCardProps) {
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
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Levels: </span>
            <span className="font-medium">{policy.levels.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rules: </span>
            <span className="font-medium">{policy.rules.length}</span>
          </div>
        </div>

        {showLevels && policy.levels.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Escalation Levels:</p>
            <EscalationLevelList levels={policy.levels} />
          </div>
        )}

        {policy.rules.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Trigger Rules:</p>
            <div className="space-y-1">
              {policy.rules.map((rule) => (
                <div key={rule.id} className="text-sm flex justify-between">
                  <span className="text-muted-foreground">{rule.trigger_type}</span>
                  <span className={`text-xs ${rule.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t">
          Created: {formatDate(policy.created_at)}
        </div>
      </CardContent>
    </Card>
  );
}
