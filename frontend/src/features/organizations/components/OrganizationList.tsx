/**
 * OrganizationList component for PulseDesk.
 * 
 * Displays a list of organizations with:
 * - Grid layout for desktop, list layout for mobile
 * - Loading and empty states
 * - Error handling
 * - Organization selection
 * - Responsive design
 * - Accessibility features
 */

import { Building2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { OrganizationCard } from './OrganizationCard';
import type { Organization } from '../types/organization';

interface OrganizationListProps {
  organizations: Organization[];
  isLoading?: boolean;
  error?: string | null;
  currentOrganizationId?: string;
  onSelectOrganization?: (organization: Organization) => void;
  className?: string;
}

export function OrganizationList({
  organizations,
  isLoading = false,
  error = null,
  currentOrganizationId,
  onSelectOrganization,
  className,
}: OrganizationListProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading organizations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-sm text-destructive font-medium">Error loading organizations</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No organizations yet
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Create your first organization to get started with PulseDesk
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-4',
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        className
      )}
      role="list"
      aria-label="Organizations"
    >
      {organizations.map((organization) => (
        <OrganizationCard
          key={organization.id}
          organization={organization}
          isCurrent={organization.id === currentOrganizationId}
          onSelect={onSelectOrganization}
        />
      ))}
    </div>
  );
}
