/**
 * OperationsErrorState component.
 *
 * Operations-focused wrapper around the shared ErrorState primitive with
 * retry support, consistent with the PulseDesk design system.
 */

import { ErrorState } from '../../../components/ui/ErrorState';
import { cn } from '../../../utils/cn';

interface OperationsErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function OperationsErrorState({
  title = 'Unable to load operational data',
  description = 'An error occurred while loading the operational data. Please try again.',
  onRetry,
  className,
}: OperationsErrorStateProps) {
  return (
    <ErrorState
      title={title}
      description={description}
      onRetry={onRetry}
      className={cn('py-10', className)}
    />
  );
}