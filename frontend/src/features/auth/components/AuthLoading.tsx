/**
 * AuthLoading component - Loading state for authentication operations.
 * 
 * Provides consistent loading display for authentication flows.
 */

import { LoaderCircle } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface AuthLoadingProps {
  message?: string;
  className?: string;
}

export function AuthLoading({ message = 'Loading...', className }: AuthLoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8', className)}>
      <LoaderCircle className="h-8 w-8 text-primary animate-spin mb-4" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
