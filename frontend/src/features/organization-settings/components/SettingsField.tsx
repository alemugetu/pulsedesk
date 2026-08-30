/**
 * SettingsField component - reusable field presentation for settings forms.
 * 
 * Provides consistent styling and layout for individual settings fields
 * with label, description, and input/controls.
 */

import { type ReactNode, type LabelHTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

interface SettingsFieldProps {
  /** Field label */
  label: string;
  /** Field description/help text */
  description?: string;
  /** Field input/control */
  children: ReactNode;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Additional props for the label element */
  labelProps?: LabelHTMLAttributes<HTMLLabelElement>;
}

export function SettingsField({
  label,
  description,
  children,
  disabled = false,
  className,
  labelProps,
}: SettingsFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label
        {...labelProps}
        className={cn(
          'block text-sm font-medium text-foreground',
          disabled && 'opacity-50',
          labelProps?.className
        )}
      >
        {label}
      </label>
      {description && (
        <p className={cn('text-sm text-muted-foreground', disabled && 'opacity-50')}>
          {description}
        </p>
      )}
      <div className={cn(disabled && 'opacity-50 pointer-events-none')}>
        {children}
      </div>
    </div>
  );
}
