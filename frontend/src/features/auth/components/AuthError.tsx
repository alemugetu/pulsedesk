/**
 * AuthError component - Displays authentication error messages.
 * 
 * Provides consistent error display for authentication flows.
 */

import { AlertCircle } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface AuthErrorProps {
  message: string | null;
  className?: string;
}

export function AuthError({ message, className }: AuthErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30',
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-red-800 dark:text-red-200">
        {message}
      </p>
    </div>
  );
}
