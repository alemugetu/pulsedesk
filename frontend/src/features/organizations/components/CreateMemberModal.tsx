/**
 * CreateMemberModal component for PulseDesk.
 *
 * Provides an accessible, beautiful modal dialog to:
 * 1. Register a new user account and add them to the current organization with a selected role.
 * 2. Add an existing user account to the current organization by email with a selected role.
 *
 * Features:
 * - Tabbed mode: "Create New User" vs "Add Existing User"
 * - Secure password inputs with password match validation
 * - Dynamic role selector showing System Roles and Custom Roles
 * - Accessible dialog with semantic labels, focus management, error messaging
 * - Loading and progress states
 * - Responsive design adhering to PulseDesk dark-slate/indigo design system
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  UserPlus,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { useOrganizationRoles } from '../hooks/useOrganizationRoles';
import { useRegisterAndAddMember, useAddMember } from '../hooks/useOrganizationMembers';
import { cn } from '../../../utils/cn';

interface CreateMemberModalProps {
  organizationId: string;
  organizationName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Mode = 'new_user' | 'existing_user';

export function CreateMemberModal({
  organizationId,
  organizationName,
  isOpen,
  onClose,
  onSuccess,
}: CreateMemberModalProps) {
  const [mode, setMode] = useState<Mode>('new_user');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: roles = [] } = useOrganizationRoles(organizationId);
  const registerAndAddMutation = useRegisterAndAddMember(organizationId);
  const addMemberMutation = useAddMember(organizationId);

  const isPending = registerAndAddMutation.isPending || addMemberMutation.isPending;

  const roleOptions: SelectOption[] = useMemo(() => {
    const systemRoles = roles.filter((r) => r.is_system_role);
    const customRoles = roles.filter((r) => !r.is_system_role);

    return [
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
  }, [roles]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setSelectedRoleId('');
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

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

        setSuccessMessage(`Successfully registered and invited ${trimmedEmail}!`);
        setTimeout(() => {
          handleClose();
          onSuccess?.();
        }, 1200);
      } catch (err) {
        // Extract detailed error message
        let errorMessage = 'Failed to invite member.';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          
          // Check for specific password validation errors
          if (errorMessage.includes('password')) {
            if (errorMessage.includes('too common')) {
              errorMessage = 'This password is too common. Please choose a more secure password.';
            } else if (errorMessage.includes('similar')) {
              errorMessage = 'The password is too similar to your personal information. Please choose a different password.';
            } else if (errorMessage.includes('numeric')) {
              errorMessage = 'Password cannot be entirely numeric. Please include letters.';
            }
          }
        }
        
        setFormError(errorMessage);
      }
    } else {
      // Existing user mode
      try {
        await addMemberMutation.mutateAsync({
          email: trimmedEmail,
          role_id: selectedRoleId || null,
        });

        setSuccessMessage(`Successfully invited ${trimmedEmail} to the team!`);
        setTimeout(() => {
          handleClose();
          onSuccess?.();
        }, 1200);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to send invitation.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-member-title"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="create-member-title" className="text-lg font-semibold text-foreground">
                Invite Team Member
              </h2>
              <p className="text-xs text-muted-foreground">
                Inviting to <span className="font-medium text-foreground">{organizationName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-border bg-muted/20 px-6 pt-2">
          <button
            type="button"
            onClick={() => {
              setMode('new_user');
              setFormError(null);
            }}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors',
              mode === 'new_user'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Register & Invite New User
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('existing_user');
              setFormError(null);
            }}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors',
              mode === 'existing_user'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Invite by Email
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {successMessage && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm"
                role="status"
              >
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {mode === 'new_user' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="member-first-name"
                    className="block text-xs font-medium text-muted-foreground mb-1"
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
                    className="block text-xs font-medium text-muted-foreground mb-1"
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
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Email Address <span className="text-destructive">*</span>
              </label>
              <div className="relative">
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
            </div>

            {mode === 'new_user' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="member-password"
                    className="block text-xs font-medium text-muted-foreground mb-1"
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
                    className="block text-xs font-medium text-muted-foreground mb-1"
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

            {mode === 'new_user' && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>At least 8 characters long</li>
                  <li>Not a common password</li>
                  <li>Not similar to your personal information</li>
                  <li>Cannot be entirely numeric</li>
                </ul>
              </div>
            )}

            <div>
              <label
                htmlFor="member-role"
                className="block text-xs font-medium text-muted-foreground mb-1"
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
              <p className="text-xs text-muted-foreground mt-1">
                Roles define incident access, reports, and administrative capabilities.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
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
                {mode === 'new_user' ? 'Create & Invite Member' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
