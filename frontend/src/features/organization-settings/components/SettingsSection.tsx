/**
 * SettingsSection component - reusable visual grouping for related settings.
 * 
 * Provides consistent card-based layout for organizing settings into
 * logical sections (e.g., Incident Settings, Notifications, SLA).
 */

import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';

interface SettingsSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Section content/fields */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
      </CardContent>
    </Card>
  );
}
