/**
 * OrganizationMembers component for PulseDesk.
 *
 * Displays organization members with:
 * - Member list with user info, status badge, and roles
 * - Role assignment for authorized users (role.assign)
 * - Member creation via Add Member modal (member.invite)
 * - Member suspension and reactivation (member.suspend)
 * - Member removal with confirmation (member.remove)
 * - Search and filtering (by name, email, status)
 * - Loading and empty states
 * - Error handling
 * - Responsive design & accessibility
 */

import { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Loader2,
  AlertCircle,
  Shield,
  Mail,
  User,
  Pencil,
  X,
  Check,
  Search,
  UserX,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import {
  useOrganizationMembers,
  useAssignMembershipRole,
  useUpdateMemberStatus,
  useRemoveMember,
} from '../hooks/useOrganizationMembers';
import { useOrganizationRoles } from '../hooks/useOrganizationRoles';
import { useOrganizationContext } from '../context/organizationContextDef';
import type { MembershipStatus, Membership } from '../types/membership';
import type { Role } from '../types/role';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { FocusTrap } from '../../../components/accessibility/FocusTrap';
import { CreateMemberModal } from './CreateMemberModal';

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
      return { color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20', label: 'Active' };
    case 'SUSPENDED':
      return { color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20', label: 'Suspended' };
    case 'REMOVED':
      return { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Removed' };
    default:
      return { color: 'bg-muted text-muted-foreground border-border', label: 'Unknown' };
  }
}

export function OrganizationMembers({ organizationId, className }: OrganizationMembersProps) {
  const {
    data: members = [],
    isLoading,
    error,
  } = useOrganizationMembers(organizationId);
  const { data: roles = [] } = useOrganizationRoles(organizationId);
  const { currentOrganization, hasPermission } = useOrganizationContext();

  const assignRole = useAssignMembershipRole(organizationId);
  const updateStatus = useUpdateMemberStatus(organizationId);
  const removeMember = useRemoveMember(organizationId);

  // Modals and dialog states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmSuspendMember, setConfirmSuspendMember] = useState<Membership | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<Membership | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const canInvite = hasPermission('member.invite');
  const canAssignRoles = hasPermission('role.assign');
  const canSuspend = hasPermission('member.suspend');
  const canRemove = hasPermission('member.remove');

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesStatus =
        statusFilter === 'ALL' || m.status === statusFilter;
      const search = searchQuery.toLowerCase().trim();
      const fullName = `${m.user.first_name || ''} ${m.user.last_name || ''}`.toLowerCase();
      const email = (m.user.email || '').toLowerCase();
      const roleName = (m.role?.name || '').toLowerCase();
      const matchesSearch =
        !search ||
        fullName.includes(search) ||
        email.includes(search) ||
        roleName.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [members, statusFilter, searchQuery]);

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

  const handleToggleStatus = async (member: Membership) => {
    const nextStatus: MembershipStatus =
      member.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    try {
      setActionError(null);
      await updateStatus.mutateAsync({
        membershipId: member.id,
        data: { status: nextStatus },
      });
      setConfirmSuspendMember(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update member status');
    }
  };

  const handleExecuteRemove = async (member: Membership) => {
    try {
      setActionError(null);
      await removeMember.mutateAsync(member.id);
      setConfirmRemoveMember(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
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

  return (
    <div className={cn('space-y-4', className)}>
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Members ({members.length})
          </h3>
        </div>

        {canInvite && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        )}
      </div>

      {/* Global Action Error Alert */}
      {actionError && (
        <div
          className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="p-1 rounded hover:bg-destructive/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            fullWidth
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'REMOVED', label: 'Removed' },
            ]}
            fullWidth
          />
        </div>
      </div>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border bg-card/50"
          role="status"
          aria-live="polite"
        >
          <Users className="h-12 w-12 text-muted-foreground mb-3 opacity-40" />
          <h4 className="text-base font-semibold text-foreground mb-1">
            {members.length === 0 ? 'No members in this organization' : 'No matching members found'}
          </h4>
          <p className="text-xs text-muted-foreground text-center max-w-sm mb-4">
            {members.length === 0
              ? 'Get started by inviting colleagues and adding members to your organization team.'
              : 'Try changing your search keywords or status filter to find members.'}
          </p>
          {canInvite && members.length === 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add First Member
            </Button>
          )}
        </div>
      ) : (
        <div
          className="space-y-3"
          role="list"
          aria-label="Organization members"
        >
          {filteredMembers.map((member) => {
            const statusBadge = getStatusBadge(member.status);
            const isEditing = editingMember?.id === member.id;
            const isOwnerRole = member.role?.slug === 'organization-owner';

            return (
              <div
                key={member.id}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors gap-4',
                  member.status === 'SUSPENDED' && 'opacity-80 border-yellow-500/20 bg-yellow-500/5'
                )}
                role="listitem"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  {/* Avatar / User icon */}
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 font-semibold text-sm',
                      member.status === 'SUSPENDED'
                        ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {member.user.first_name ? (
                      member.user.first_name[0].toUpperCase()
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {member.user.first_name && member.user.last_name
                          ? `${member.user.first_name} ${member.user.last_name}`
                          : member.user.email}
                      </p>
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                          statusBadge.color
                        )}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{member.user.email}</span>
                    </div>
                  </div>
                </div>

                {/* Role / Management Controls */}
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <RoleSelector
                          roles={roles}
                          selectedRoleId={selectedRoleId}
                          onRoleChange={setSelectedRoleId}
                        />
                        {assignmentError && (
                          <p className="text-xs text-destructive" role="alert">
                            {assignmentError}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSaveRole}
                        isLoading={assignRole.isPending}
                        disabled={assignRole.isPending}
                        aria-label="Save assigned role"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={assignRole.isPending}
                        aria-label="Cancel editing role"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-left sm:text-right">
                        <div className="flex items-center sm:justify-end gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-semibold text-foreground">
                            {member.role?.name || 'No role'}
                          </p>
                        </div>
                        {member.role?.slug && (
                          <p className="text-[10px] text-muted-foreground tracking-wide font-mono">
                            {member.role.slug}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {canAssignRoles && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(member)}
                            aria-label={`Change role for ${member.user.email}`}
                            title="Change role"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {canSuspend && !isOwnerRole && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmSuspendMember(member)}
                            aria-label={
                              member.status === 'SUSPENDED'
                                ? `Reactivate ${member.user.email}`
                                : `Suspend ${member.user.email}`
                            }
                            title={
                              member.status === 'SUSPENDED'
                                ? 'Reactivate member'
                                : 'Suspend member'
                            }
                          >
                            {member.status === 'SUSPENDED' ? (
                              <UserCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            ) : (
                              <UserX className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                            )}
                          </Button>
                        )}

                        {canRemove && !isOwnerRole && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmRemoveMember(member)}
                            aria-label={`Remove ${member.user.email}`}
                            title="Remove member"
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Member */}
      <CreateMemberModal
        organizationId={organizationId}
        organizationName={currentOrganization?.name || 'Organization'}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Modal Dialog: Confirm Suspend/Reactivate */}
      {confirmSuspendMember && (
        <FocusTrap
          active={!!confirmSuspendMember}
          onEscape={() => setConfirmSuspendMember(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  confirmSuspendMember.status === 'SUSPENDED'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                )}
              >
                {confirmSuspendMember.status === 'SUSPENDED' ? (
                  <UserCheck className="h-5 w-5" />
                ) : (
                  <UserX className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 id="suspend-dialog-title" className="text-base font-semibold text-foreground">
                  {confirmSuspendMember.status === 'SUSPENDED'
                    ? 'Reactivate Team Member'
                    : 'Suspend Team Member'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {confirmSuspendMember.user.email}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {confirmSuspendMember.status === 'SUSPENDED'
                ? 'Reactivating this member will restore their access to this organization and permissions according to their role.'
                : 'Suspended members cannot access organization incidents, operations, or settings while their membership is suspended.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmSuspendMember(null)}
                disabled={updateStatus.isPending}
              >
                Cancel
              </Button>
              <Button
                variant={confirmSuspendMember.status === 'SUSPENDED' ? 'primary' : 'destructive'}
                size="sm"
                onClick={() => handleToggleStatus(confirmSuspendMember)}
                isLoading={updateStatus.isPending}
                disabled={updateStatus.isPending}
              >
                {confirmSuspendMember.status === 'SUSPENDED'
                  ? 'Reactivate Member'
                  : 'Suspend Member'}
              </Button>
            </div>
          </div>
        </FocusTrap>
      )}

      {/* Modal Dialog: Confirm Removal */}
      {confirmRemoveMember && (
        <FocusTrap
          active={!!confirmRemoveMember}
          onEscape={() => setConfirmRemoveMember(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl border border-destructive/20 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 id="remove-dialog-title" className="text-base font-semibold text-foreground">
                  Remove Team Member
                </h3>
                <p className="text-xs text-muted-foreground">
                  {confirmRemoveMember.user.email}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove this member from <strong className="text-foreground">{currentOrganization?.name}</strong>? They will lose all access to this organization immediately.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={removeMember.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleExecuteRemove(confirmRemoveMember)}
                isLoading={removeMember.isPending}
                disabled={removeMember.isPending}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </FocusTrap>
      )}
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
    ...(systemRoles.length > 0
      ? [{ value: '__system__', label: '── System Roles ──', disabled: true }]
      : []),
    ...systemRoles.map((role) => ({
      value: role.id,
      label: role.name,
    })),
    ...(customRoles.length > 0
      ? [{ value: '__custom__', label: '── Custom Roles ──', disabled: true }]
      : []),
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
