/**
 * OperationsEmptyState component.
 *
 * Operations-focused wrapper around the shared EmptyState primitive,
 * consistent with the PulseDesk design system.
 */

import { type ReactNode } from 'react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../utils/cn';

interface OperationsEmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function OperationsEmptyState({
  title = 'No operational data',
  description = 'There is no operational data to display for this organization at this time.',
  icon,
  action,
  className,
}: OperationsEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={icon}
      action={action}
      className={cn('py-10', className)}
    />
  );
}