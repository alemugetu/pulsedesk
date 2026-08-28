/**
 * OrganizationCard component for PulseDesk.
 * 
 * Displays a single organization in a card format with:
 * - Organization name and status
 * - Navigation to organization detail
 * - Visual indicators for current selection
 * - Responsive design
 * - Accessibility features
 */

import { Building2, CheckCircle, Clock, Archive } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { Organization, OrganizationStatus } from '../types/organization';

interface OrganizationCardProps {
  organization: Organization;
  isCurrent?: boolean;
  onSelect?: (organization: Organization) => void;
  className?: string;
}

/**
 * Get status icon and color based on organization status
 */
function getStatusIcon(status: OrganizationStatus) {
  switch (status) {
    case 'ACTIVE':
      return { icon: CheckCircle, color: 'text-green-500', label: 'Active' };
    case 'SUSPENDED':
      return { icon: Clock, color: 'text-yellow-500', label: 'Suspended' };
    case 'ARCHIVED':
      return { icon: Archive, color: 'text-gray-500', label: 'Archived' };
    default:
      return { icon: CheckCircle, color: 'text-green-500', label: 'Active' };
  }
}

export function OrganizationCard({
  organization,
  isCurrent = false,
  onSelect,
  className,
}: OrganizationCardProps) {
  const statusInfo = getStatusIcon(organization.status);
  const StatusIcon = statusInfo.icon;

  const handleClick = () => {
    if (onSelect) {
      onSelect(organization);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group relative w-full text-left p-6 rounded-lg border border-border',
        'bg-card hover:bg-accent hover:border-accent-foreground/50',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
        'transition-all duration-200',
        isCurrent && 'border-primary/50 bg-accent',
        className
      )}
      aria-label={`Select ${organization.name} organization`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Organization icon */}
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              'bg-primary/10 text-primary',
              'group-hover:bg-primary/20 transition-colors'
            )}
          >
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>

          {/* Organization info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {organization.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                {organization.slug}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  statusInfo.color
                )}
              >
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* Current indicator */}
        {isCurrent && (
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="sr-only">Current organization</span>
          </div>
        )}
      </div>

      {/* Creation date */}
      <div className="mt-4 text-xs text-muted-foreground">
        Created {new Date(organization.created_at).toLocaleDateString()}
      </div>
    </button>
  );
}
