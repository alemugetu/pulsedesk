/**
 * SkipToContent component for PulseDesk.
 * 
 * Provides an accessible skip-navigation link that allows keyboard and
 * screen-reader users to bypass repetitive navigation elements and jump
 * directly to the main content area.
 */

import React from 'react';
import { cn } from '../../utils/cn';

export interface SkipToContentProps {
  /** The target element id to jump to. Default: 'main-content' */
  targetId?: string;
  /** Label for the skip link. Default: 'Skip to main content' */
  label?: string;
  /** Additional CSS class names */
  className?: string;
}

export function SkipToContent({
  targetId = 'main-content',
  label = 'Skip to main content',
  className,
}: SkipToContentProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.tabIndex = -1;
      target.focus({ preventScroll: false });
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn('skip-to-content-link', className)}
      aria-label={label}
    >
      {label}
    </a>
  );
}
