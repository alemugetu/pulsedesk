/**
 * PermissionRouteGuard for PulseDesk.
 *
 * Route guard component that checks whether the current user has the
 * required permission before rendering children.
 *
 * When the user lacks the required permission, renders an accessible
 * Forbidden / Unauthorized view with options to go back or navigate home.
 *
 * Usage:
 *   <PermissionRouteGuard permission="member.view">
 *     <MembersPage />
 *   </PermissionRouteGuard>
 */

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { Button } from '../../components/ui/Button';

interface PermissionRouteGuardProps {
  /** The permission codename required to access this route (e.g. "member.view") */
  permission: string;
  /** Child elements to render when the user has the required permission */
  children: ReactNode;
}

export function PermissionRouteGuard({ permission, children }: PermissionRouteGuardProps) {
  const { hasPermission, currentOrganization } = useOrganizationContext();
  const navigate = useNavigate();

  // If no organization is selected, let the children render — 
  // the page itself should handle the "no org" state
  if (!currentOrganization) {
    return <>{children}</>;
  }

  // Check permission
  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  // Render Forbidden state
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-6">
        <ShieldX className="h-8 w-8" />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">
        Access Denied
      </h1>

      <p className="text-sm text-muted-foreground max-w-md mb-2">
        You don't have the required permission to access this page.
      </p>

      <p className="text-xs text-muted-foreground/70 mb-8 font-mono">
        Required: <code className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{permission}</code>
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          aria-label="Go back to previous page"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/app')}
          aria-label="Go to home page"
        >
          <Home className="h-4 w-4 mr-2" />
          Home
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-8 max-w-sm">
        If you believe you should have access, contact your organization administrator
        to update your role and permissions.
      </p>
    </div>
  );
}
