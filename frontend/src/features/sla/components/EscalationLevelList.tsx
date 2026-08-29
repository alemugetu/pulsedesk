/**
 * EscalationLevelList component.
 * 
 * Displays escalation levels according to the actual backend model/API.
 * Shows ordered escalation steps with delay and target information.
 */

import type { EscalationLevel } from '../types/escalation.types';

interface EscalationLevelListProps {
  levels: EscalationLevel[];
  className?: string;
}

/**
 * Format delay for display
 */
function formatDelay(delayMinutes: number): string {
  if (delayMinutes === 0) {
    return 'Immediate';
  }
  if (delayMinutes < 60) {
    return `${delayMinutes}m`;
  }
  const hours = Math.floor(delayMinutes / 60);
  const minutes = delayMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Format target for display
 */
function formatTarget(targetType: string, targetReference: string): string {
  if (targetType === 'ASSIGNEE') {
    return 'Current Assignee';
  }
  if (targetType === 'ROLE' && targetReference) {
    return `Role: ${targetReference}`;
  }
  return targetType;
}

export function EscalationLevelList({ levels, className = '' }: EscalationLevelListProps) {
  if (!levels || levels.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No escalation levels configured.
      </div>
    );
  }

  // Sort by level number to ensure correct order
  const sortedLevels = [...levels].sort((a, b) => a.level - b.level);

  return (
    <div className={`space-y-3 ${className}`}>
      {sortedLevels.map((level) => (
        <div
          key={level.id}
          className="flex items-start space-x-3 p-3 rounded-lg border bg-card"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {level.level}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium truncate">{level.name}</h4>
              <span className="text-xs text-muted-foreground ml-2">
                {formatDelay(level.delay_minutes)}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Target: {formatTarget(level.target_type, level.target_reference)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
