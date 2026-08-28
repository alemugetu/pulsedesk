/**
 * AuthLayout component - Layout wrapper for authentication pages.
 * 
 * Provides a consistent visual container for all authentication pages.
 * Follows the existing theme system and supports light/dark/system modes.
 */

import { type ReactNode } from 'react';
import { cn } from '../../../utils/cn';

interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn(
      'min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8',
      className
    )}>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
