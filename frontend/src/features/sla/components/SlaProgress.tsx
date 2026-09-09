import type { SLAStatus } from '../types/sla.types';
import { useSlaCountdown } from '../hooks/useIncidentSla';

interface SlaProgressProps {
  deadline: string;
  completedAt: string | null;
  status: SLAStatus;
  breached?: boolean;
  className?: string;
}

/**
 * Get progress bar color based on SLA status
 */
function getStatusAccentClass(status: SLAStatus): string {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-green-500';
    case 'BREACHED':
      return 'bg-red-500';
    case 'COMPLETED':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
}

export function SlaProgress({
  deadline,
  completedAt,
  status,
  breached,
  className = '',
}: SlaProgressProps) {
  const { timeRemaining, isBreached, isCompleted } = useSlaCountdown(
    deadline,
    completedAt,
    status,
    breached
  );
  const deadlineDate = new Date(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        SLA timing unavailable
      </div>
    );
  }

  const effectiveStatus: SLAStatus = isCompleted
    ? 'COMPLETED'
    : isBreached
      ? 'BREACHED'
      : status;

  const timingText = isCompleted
    ? `Completed${completedAt ? ` at ${formatTimestamp(completedAt)}` : ''}`
    : isBreached
      ? `Deadline breached at ${formatTimestamp(deadline)}`
      : `${timeRemaining} remaining`;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`} role="status">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${getStatusAccentClass(effectiveStatus)}`}
        aria-hidden="true"
      />
      <span
        className={
          effectiveStatus === 'BREACHED'
            ? 'text-destructive font-medium'
            : 'text-muted-foreground'
        }
      >
        {timingText}
      </span>
    </div>
  );
}
