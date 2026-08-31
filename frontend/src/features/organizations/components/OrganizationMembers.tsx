/**
 * OrganizationMembers component for PulseDesk.
 *
 * Displays organization members with:
 * - Member list with user info and roles
 * - Role assignment for authorized users
 * - Loading and empty states
 * - Error handling
 * - Status indicators
 * - Responsive design
 * - Accessibility features
 */

import { useState } from 'react';
import { Users, Loader2, AlertCircle, Shield, Mail, User, Pencil, X, Check } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useOrganizationMembers } from '../hooks/useOrganizationMembers';
import { useOrganizationRoles } from '../hooks/useOrganizationRoles';
import { useAssignMembershipRole } from '../hooks/useOrganizationMembers';
import { useOrganizationContext } from '../context/organizationContextDef';
import type { MembershipStatus, Membership } from '../types/membership';
import type { Role } from '../types/role';
import { Button } from '../../../components/ui/Button';
import { Select, type SelectOption } from '../../../components/ui/Select';

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
  const { data: roles = [] } = useOrganizationRoles(organizationId);
  const { hasPermission } = useOrganizationContext();
  const assignRole = useAssignMembershipRole(organizationId);
  
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const canAssignRoles = hasPermission('role.assign');

  const handleStartEdit = (member: Membership) => {
    setEditingMember(member);
    setSelectedRoleId(member.role?.id || '');
    setAssignmentError(null);
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setSelectedRoleId('');
    setAssignmentError(null);
  };

  const handleSaveRole = async () => {
    if (!editingMember) return;

    try {
      setAssignmentError(null);
      await assignRole.mutateAsync({
        membershipId: editingMember.id,
        data: { role_id: selectedRoleId || null },
      });
      handleCancelEdit();
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : 'Failed to assign role');
    }
  };

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
          const isEditing = editingMember?.id === member.id;
          
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

              {/* Role info / Role assignment */}
              {isEditing ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex flex-col gap-1">
                    <RoleSelector
                      roles={roles}
                      selectedRoleId={selectedRoleId}
                      onRoleChange={setSelectedRoleId}
                    />
                    {assignmentError && (
                      <p className="text-xs text-red-500" role="alert">
                        {assignmentError}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveRole}
                    isLoading={assignRole.isPending}
                    disabled={assignRole.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={assignRole.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
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
                  {canAssignRoles && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(member)}
                      aria-label={`Change role for ${member.user.email}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RoleSelectorProps {
  roles: Role[];
  selectedRoleId: string;
  onRoleChange: (roleId: string) => void;
}

function RoleSelector({ roles, selectedRoleId, onRoleChange }: RoleSelectorProps) {
  const systemRoles = roles.filter((role) => role.is_system_role);
  const customRoles = roles.filter((role) => !role.is_system_role);

  const options: SelectOption[] = [
    { value: '', label: 'No role' },
    ...(systemRoles.length > 0 ? [{ value: '__system__', label: '── System Roles ──', disabled: true }] : []),
    ...systemRoles.map((role) => ({
      value: role.id,
      label: role.name,
    })),
    ...(customRoles.length > 0 ? [{ value: '__custom__', label: '── Custom Roles ──', disabled: true }] : []),
    ...customRoles.map((role) => ({
      value: role.id,
      label: role.name,
    })),
  ];

  return (
    <div className="w-48">
      <label htmlFor="role-select" className="sr-only">
        Select role
      </label>
      <Select
        id="role-select"
        value={selectedRoleId}
        onChange={(e) => onRoleChange(e.target.value)}
        options={options}
        fullWidth
      />
    </div>
  );
}
