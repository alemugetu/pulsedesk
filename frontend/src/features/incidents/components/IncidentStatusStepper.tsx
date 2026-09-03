/**
 * IncidentStatusStepper component.
 * 
 * Visual operational lifecycle stepper:
 * OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED
 */

import { Check, Clock, AlertCircle, CheckCircle2, Archive } from 'lucide-react';
import type { IncidentStatus } from '../types/incident.types';
import { cn } from '../../../utils/cn';

interface IncidentStatusStepperProps {
  currentStatus: IncidentStatus;
  createdAt?: string;
  resolvedAt?: string | null;
  className?: string;
}

interface StepConfig {
  status: IncidentStatus;
  label: string;
  description: string;
  icon: typeof Check;
}

const STEPS: StepConfig[] = [
  {
    status: 'OPEN',
    label: 'Open',
    description: 'Reported & Triaged',
    icon: AlertCircle,
  },
  {
    status: 'ACKNOWLEDGED',
    label: 'Acknowledged',
    description: 'Claimed by Assignee',
    icon: Check,
  },
  {
    status: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Active Remediation',
    icon: Clock,
  },
  {
    status: 'RESOLVED',
    label: 'Resolved',
    description: 'Fix Implemented',
    icon: CheckCircle2,
  },
  {
    status: 'CLOSED',
    label: 'Closed',
    description: 'Verified & Concluded',
    icon: Archive,
  },
];

const STATUS_ORDER: Record<IncidentStatus, number> = {
  OPEN: 0,
  ACKNOWLEDGED: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
};

export function IncidentStatusStepper({
  currentStatus,
  className = '',
}: IncidentStatusStepperProps) {
  const currentIndex = STATUS_ORDER[currentStatus] ?? 0;

  return (
    <div className={cn('w-full py-3', className)} aria-label="Incident Lifecycle Progress">
      {/* Desktop & Tablet Stepper */}
      <nav aria-label="Progress" className="hidden sm:block">
        <ol className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isUpcoming = idx > currentIndex;
            const Icon = step.icon;

            return (
              <li
                key={step.status}
                className={cn(
                  'relative flex-1 flex flex-col items-center text-center',
                  idx !== STEPS.length - 1 && 'after:content-[""] after:w-full after:h-0.5 after:top-4 after:left-1/2 after:absolute after:-z-1',
                  idx !== STEPS.length - 1 && (isCompleted ? 'after:bg-emerald-500' : 'after:bg-border')
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all z-10',
                    isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-primary bg-primary/15 text-primary ring-4 ring-primary/20 scale-110 shadow-sm',
                    isUpcoming && 'border-muted bg-card text-muted-foreground'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="mt-2.5 space-y-0.5">
                  <p
                    className={cn(
                      'text-xs font-semibold tracking-wide',
                      isCurrent && 'text-primary font-bold',
                      isCompleted && 'text-foreground',
                      isUpcoming && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground hidden md:block">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile Stepper Bar */}
      <div className="sm:hidden flex items-center justify-between p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">Current Status:</span>
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">
            {currentStatus.replace('_', ' ')}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          Step {currentIndex + 1} of 5
        </span>
      </div>
    </div>
  );
}
