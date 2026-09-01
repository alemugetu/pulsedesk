/**
 * LiveRegion component for PulseDesk.
 * 
 * Provides an accessible ARIA live container for announcing dynamic changes
 * (e.g. form submissions, connection status updates, asynchronous load completions)
 * to screen-reader users without overwhelming them.
 */

import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

export interface LiveRegionProps {
  /** The message text to announce */
  message?: string;
  /** Politeness level: 'polite' (default) or 'assertive' */
  priority?: 'polite' | 'assertive';
  /** ARIA role: 'status' (default) or 'alert' or 'log' */
  role?: 'status' | 'alert' | 'log';
  /** Whether the message is also visible visually. Defaults to false (sr-only) */
  visible?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional custom children */
  children?: React.ReactNode;
}

export function LiveRegion({
  message,
  priority = 'polite',
  role = 'status',
  visible = false,
  className,
  children,
}: LiveRegionProps) {
  const [currentMessage, setCurrentMessage] = useState<string | undefined>(message);

  useEffect(() => {
    // A slight timeout ensures DOM change detection in assistive technologies
    const timer = setTimeout(() => {
      setCurrentMessage(message);
    }, 50);

    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div
      role={role}
      aria-live={priority}
      aria-atomic="true"
      className={cn(!visible && 'sr-only', className)}
    >
      {currentMessage}
      {children}
    </div>
  );
}
