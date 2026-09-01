/**
 * FocusTrap component for PulseDesk.
 * 
 * Traps keyboard focus within its children, handles Escape key,
 * and restores focus to the triggering element upon unmount.
 */

import React, { useRef } from 'react';
import { useFocusManagement } from '../../hooks/useFocusManagement';

export interface FocusTrapProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the focus trap is actively enabled */
  active?: boolean;
  /** Callback when the user presses the Escape key */
  onEscape?: () => void;
  /** Specific element to focus initially upon activation */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Specific element to return focus to upon deactivation */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Child content */
  children: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
}

export function FocusTrap({
  active = true,
  onEscape,
  initialFocusRef,
  returnFocusRef,
  children,
  className,
  ...rest
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusManagement<HTMLDivElement>({
    isActive: active,
    containerRef,
    initialFocusRef,
    returnFocusRef,
    onEscape,
    trapFocusEnabled: active,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={-1}
      style={{ outline: 'none' }}
      {...rest}
    >
      {children}
    </div>
  );
}
