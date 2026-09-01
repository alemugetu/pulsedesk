/**
 * MembersPage for PulseDesk.
 * 
 * Direct access to team member management for the current organization.
 * This provides a more accessible way to manage members compared to
 * navigating through Organization → Members tab.
 * 
 * Features:
 * - Display current organization's members
 * - Role assignment for authorized users
 * - Member status display
 * - Integration with OrganizationContext
 * - Loading and error states
 * - Responsive design
 * - Accessibility features
 */

import { Users, AlertCircle } from 'lucide-react';
import { OrganizationMembers } from '../../features/organizations/components/OrganizationMembers';
import { useCurrentOrganization } from '../../features/organizations/context/organizationContextDef';

export function MembersPage() {
  const organization = useCurrentOrganization();

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No organization selected
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Please select an organization to manage team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
            <p className="text-sm text-muted-foreground">
              Manage members and roles for {organization.name}
            </p>
          </div>
        </div>
      </div>

      {/* Members component */}
      <OrganizationMembers organizationId={organization.id} />
    </div>
  );
}
