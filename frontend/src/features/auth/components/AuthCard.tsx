/**
 * AuthCard component - Card container for authentication forms.
 * 
 * Provides a styled card that follows the PulseDesk design system.
 * Supports the existing theme system.
 */

import { type ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface AuthCardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function AuthCard({ children, title, description, className }: AuthCardProps) {
  return (
    <div className={cn(
      'bg-card border border-border rounded-lg shadow-lg p-8',
      className
    )}>
      {(title || description) && (
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Activity className="h-12 w-12 text-primary" aria-hidden="true" />
          </div>
          {title && (
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
