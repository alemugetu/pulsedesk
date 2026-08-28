/**
 * OrganizationRoles component for PulseDesk.
 * 
 * Displays organization roles with:
 * - Role list with names and permissions
 * - System role indicators
 * - Loading and empty states
 * - Error handling
 * - Permission display
 * - Responsive design
 * - Accessibility features
 */

import { Shield, Loader2, AlertCircle, Lock, Key } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useOrganizationRoles } from '../hooks/useOrganizationRoles';

interface OrganizationRolesProps {
  organizationId: string;
  className?: string;
}

export function OrganizationRoles({ organizationId, className }: OrganizationRolesProps) {
  const {
    data: roles = [],
    isLoading,
    error,
  } = useOrganizationRoles(organizationId);

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
        <p className="text-sm text-muted-foreground">Loading roles...</p>
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
        <p className="text-sm text-destructive font-medium">Error loading roles</p>
        <p className="text-xs text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Shield className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No roles yet
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This organization doesn't have any roles configured yet
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Roles ({roles.length})
          </h3>
        </div>
      </div>

      {/* Roles list */}
      <div
        className="space-y-3"
        role="list"
        aria-label="Organization roles"
      >
        {roles.map((role) => (
          <div
            key={role.id}
            className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
            role="listitem"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Role icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  {role.is_system_role ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <Shield className="h-5 w-5" />
                  )}
                </div>

                {/* Role info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {role.name}
                    </h4>
                    {role.is_system_role && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        System
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {role.slug}
                  </p>
                </div>
              </div>

              {/* Permission count */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                <Key className="h-4 w-4" />
                <span>{role.permissions.length} permissions</span>
              </div>
            </div>

            {/* Description */}
            {role.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {role.description}
              </p>
            )}

            {/* Permissions */}
            {role.permissions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Permissions
                </p>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
