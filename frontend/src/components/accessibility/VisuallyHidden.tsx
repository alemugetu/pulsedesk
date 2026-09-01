/**
 * VisuallyHidden component for PulseDesk.
 * 
 * Hides content visually while preserving it in the accessibility tree
 * for screen readers.
 */

import React, { type ElementType, type ComponentPropsWithoutRef } from 'react';
import { cn } from '../../utils/cn';

export interface VisuallyHiddenProps<T extends ElementType = 'span'> {
  /** HTML element type to render. Default: 'span' */
  as?: T;
  /** Child elements */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function VisuallyHidden<T extends ElementType = 'span'>({
  as,
  children,
  className,
  ...props
}: VisuallyHiddenProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof VisuallyHiddenProps<T>>) {
  const Component = as || 'span';

  return (
    <Component className={cn('sr-only', className)} {...props}>
      {children}
    </Component>
  );
}
