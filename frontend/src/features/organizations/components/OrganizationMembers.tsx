/**
 * OrganizationMembers component for PulseDesk.
 * 
 * Displays organization members with:
 * - Member list with user info and roles
 * - Loading and empty states
 * - Error handling
 * - Status indicators
 * - Responsive design
 * - Accessibility features
 */

import { Users, Loader2, AlertCircle, Shield, Mail, User } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useOrganizationMembers } from '../hooks/useOrganizationMembers';
import type { MembershipStatus } from '../types/membership';

interface OrganizationMembersProps {
  organizationId: string;
  className?: string;
}

/**
 * Get status badge color and label
 */
function getStatusBadge(status: MembershipStatus) {
  switch (status) {
    case 'ACTIVE':
      return { color: 'bg-green-500/10 text-green-700 dark:text-green-400', label: 'Active' };
    case 'SUSPENDED':
      return { color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', label: 'Suspended' };
    case 'REMOVED':
      return { color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400', label: 'Removed' };
    default:
      return { color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400', label: 'Unknown' };
  }
}

export function OrganizationMembers({ organizationId, className }: OrganizationMembersProps) {
  const {
    data: members = [],
    isLoading,
    error,
  } = useOrganizationMembers(organizationId);

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
        <p className="text-sm text-muted-foreground">Loading members...</p>
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
        <p className="text-sm text-destructive font-medium">Error loading members</p>
        <p className="text-xs text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No members yet
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This organization doesn't have any members yet
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Members ({members.length})
          </h3>
        </div>
      </div>

      {/* Members list */}
      <div
        className="space-y-3"
        role="list"
        aria-label="Organization members"
      >
        {members.map((member) => {
          const statusBadge = getStatusBadge(member.status);
          
          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              role="listitem"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* User avatar/initials */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                  <User className="h-5 w-5" />
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.user.first_name && member.user.last_name
                        ? `${member.user.first_name} ${member.user.last_name}`
                        : member.user.email}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        statusBadge.color
                      )}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">
                      {member.user.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Role info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {member.role?.name || 'No role assigned'}
                  </p>
                  {member.role?.slug && (
                    <p className="text-xs text-muted-foreground">
                      {member.role.slug}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
