/**
 * CreateMemberPage component for PulseDesk.
 *
 * Dedicated page for adding/registering organization team members.
 * Supports:
 * - Two-stage new user registration + team membership
 * - Existing user addition by email
 * - Role selection
 * - Permission-scoped access
 * - Responsive layout & accessibility
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select, type SelectOption } from '../../components/ui/Select';
import { useCurrentOrganization, useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { useOrganizationRoles } from '../../features/organizations/hooks/useOrganizationRoles';
import { useRegisterAndAddMember, useAddMember } from '../../features/organizations/hooks/useOrganizationMembers';
import { cn } from '../../utils/cn';

type Mode = 'new_user' | 'existing_user';

export function CreateMemberPage() {
  const navigate = useNavigate();
  const organization = useCurrentOrganization();
  const { hasPermission } = useOrganizationContext();

  const [mode, setMode] = useState<Mode>('new_user');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const organizationId = organization?.id || '';
  const { data: roles = [] } = useOrganizationRoles(organizationId);
  const registerAndAddMutation = useRegisterAndAddMember(organizationId);
  const addMemberMutation = useAddMember(organizationId);

  const isPending = registerAndAddMutation.isPending || addMemberMutation.isPending;
  const canInvite = hasPermission('member.invite');

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No organization selected</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Please select an organization before creating members.
        </p>
      </div>
    );
  }

  if (!canInvite) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Permission Denied</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          You do not have permission to invite or add members to this organization.
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/app/members')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Team Members
        </Button>
      </div>
    );
  }

  const systemRoles = roles.filter((r) => r.is_system_role);
  const customRoles = roles.filter((r) => !r.is_system_role);

  const roleOptions: SelectOption[] = [
    { value: '', label: 'Select an initial role (optional)' },
    ...(systemRoles.length > 0
      ? [{ value: '__sys_header__', label: '── System Roles ──', disabled: true }]
      : []),
    ...systemRoles.map((role) => ({
      value: role.id,
      label: role.name,
    })),
    ...(customRoles.length > 0
      ? [{ value: '__custom_header__', label: '── Custom Roles ──', disabled: true }]
      : []),
    ...customRoles.map((role) => ({
      value: role.id,
      label: role.name,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('Email address is required.');
      return;
    }

    if (mode === 'new_user') {
      if (!firstName.trim()) {
        setFormError('First name is required.');
        return;
      }
      if (!lastName.trim()) {
        setFormError('Last name is required.');
        return;
      }
      if (!password) {
        setFormError('Password is required.');
        return;
      }
      if (password.length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== passwordConfirm) {
        setFormError('Passwords do not match.');
        return;
      }

      try {
        await registerAndAddMutation.mutateAsync({
          email: trimmedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password,
          password_confirm: passwordConfirm,
          role_id: selectedRoleId || null,
        });

        setSuccessMessage(`Successfully created and added member ${trimmedEmail}!`);
        setTimeout(() => {
          navigate('/app/members');
        }, 1200);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to create and add member.');
      }
    } else {
      // Existing user mode
      try {
        await addMemberMutation.mutateAsync({
          email: trimmedEmail,
          role_id: selectedRoleId || null,
        });

        setSuccessMessage(`Successfully added ${trimmedEmail} to the team!`);
        setTimeout(() => {
          navigate('/app/members');
        }, 1200);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to add member to organization.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/members')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Team Member</h1>
            <p className="text-sm text-muted-foreground">
              Add new colleagues and assign roles for <span className="font-medium text-foreground">{organization.name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Mode Selector Tabs */}
        <div className="flex border-b border-border bg-muted/20 px-6 pt-3">
          <button
            type="button"
            onClick={() => {
              setMode('new_user');
              setFormError(null);
            }}
            className={cn(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              mode === 'new_user'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Register & Add New User
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('existing_user');
              setFormError(null);
            }}
            className={cn(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              mode === 'existing_user'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Add Existing User by Email
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div
              className="flex items-center gap-2 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="flex items-center gap-2 p-3.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm"
              role="status"
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'new_user' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="member-first-name"
                  className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5"
                >
                  First Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="member-first-name"
                  type="text"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isPending}
                  required
                  fullWidth
                />
              </div>
              <div>
                <label
                  htmlFor="member-last-name"
                  className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5"
                >
                  Last Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="member-last-name"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isPending}
                  required
                  fullWidth
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="member-email"
              className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5"
            >
              Email Address <span className="text-destructive">*</span>
            </label>
            <Input
              id="member-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              required
              fullWidth
            />
          </div>

          {mode === 'new_user' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="member-password"
                  className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5"
                >
                  Password <span className="text-destructive">*</span>
                </label>
                <Input
                  id="member-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  required
                  fullWidth
                />
              </div>
              <div>
                <label
                  htmlFor="member-password-confirm"
                  className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5"
                >
                  Confirm Password <span className="text-destructive">*</span>
                </label>
                <Input
                  id="member-password-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  disabled={isPending}
                  required
                  fullWidth
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="member-role"
              className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5"
            >
              Initial Organization Role
            </label>
            <Select
              id="member-role"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              options={roleOptions}
              disabled={isPending}
              fullWidth
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Select the initial role for this team member. You can change this role at any time.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/app/members')}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isPending}
              disabled={isPending}
            >
              {mode === 'new_user' ? 'Create & Add Member' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
