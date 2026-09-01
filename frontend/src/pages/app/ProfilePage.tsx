/**
 * ProfilePage component for PulseDesk.
 *
 * Displays the authenticated user's profile and organization-scoped roles.
 * PulseDesk enforces strict organization-scoped RBAC — roles and permissions
 * belong to organization memberships, with zero global User.role assumptions.
 *
 * Features:
 * - Read-only display of user identity (Full Name, Email, Verification)
 * - Current organization membership details (Role, Status, Joined Date)
 * - Multi-organization breakdown displaying scoped roles per tenant
 * - Fully accessible semantic structure (dl/dt/dd, aria landmarks)
 */

import { useMemo } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { useOrganizationMembers } from '../../features/organizations/hooks/useOrganizationMembers';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { User, Mail, Shield, Building2, CheckCircle2, AlertCircle } from 'lucide-react';

export function ProfilePage() {
  const { authState } = useAuth();
  const { currentOrganization, organizations, getCurrentRole } = useOrganizationContext();
  const user = authState.user;

  // Fetch current organization members to get current user's detailed membership
  const currentOrgId = currentOrganization?.id ?? '';
  const { data: members = [] } = useOrganizationMembers(currentOrgId);

  // Derive current user's membership in the active organization
  const currentMembership = useMemo(() => {
    if (!user || !members.length) return null;
    return members.find((m) => m.user.id === user.id) ?? null;
  }, [user, members]);

  // Derive full display name
  const fullName = useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.first_name) {
      return user.first_name;
    }
    return user?.email ? user.email.split('@')[0] : 'User';
  }, [user]);

  // Derive role title in the current organization
  const currentRoleName = useMemo(() => {
    if (currentMembership?.role?.name) {
      return currentMembership.role.name;
    }
    const slug = getCurrentRole();
    if (slug) {
      return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return 'Organization Member';
  }, [currentMembership, getCurrentRole]);

  // Derive membership status
  const membershipStatus = currentMembership?.status ?? (user?.is_active ? 'ACTIVE' : 'INACTIVE');

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your account details and organization-scoped roles across PulseDesk.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Account Identity Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <User className="h-5 w-5 text-primary" aria-hidden="true" />
              Personal Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Full Name
                </dt>
                <dd className="mt-1 text-base font-semibold text-foreground" data-testid="profile-full-name">
                  {fullName}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email Address
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-foreground" data-testid="profile-email">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>{user?.email || 'N/A'}</span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Account Status
                </dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Badge variant={user?.is_active ? 'success' : 'error'}>
                    {user?.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {user?.is_verified ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-500" aria-hidden="true" />
                      Unverified
                    </Badge>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Current Organization Membership Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Current Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {currentOrganization ? (
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Active Organization
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-foreground" data-testid="profile-current-org">
                    {currentOrganization.name}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Organization-Scoped Role
                  </dt>
                  <dd className="mt-1 flex items-center gap-2" data-testid="profile-role">
                    <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-sm font-medium text-foreground">{currentRoleName}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Membership Status
                  </dt>
                  <dd className="mt-1" data-testid="profile-membership-status">
                    <Badge variant={membershipStatus === 'ACTIVE' ? 'success' : 'warning'}>
                      {membershipStatus}
                    </Badge>
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No active organization selected.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Multi-Organization Scope Breakdown */}
      {organizations.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground">
              Organization Memberships ({organizations.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Roles are strictly organization-scoped. Your permissions apply only within each specific organization tenant.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Organization</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Role Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {organizations.map((org) => {
                    const isCurrent = org.id === currentOrganization?.id;
                    return (
                      <tr key={org.id} className={isCurrent ? 'bg-primary/5' : undefined}>
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          <span>{org.name}</span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={org.status === 'ACTIVE' ? 'success' : 'secondary'}>
                            {org.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {isCurrent ? currentRoleName : 'Scoped membership'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
