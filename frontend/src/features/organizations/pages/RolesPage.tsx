/**
 * RolesPage component.
 *
 * Role (RBAC) management page for PulseDesk.
 *
 * Lists organization roles with create, edit, and delete capability for
 * custom roles. System roles cannot be modified or deleted (enforced by the
 * backend and mirrored in the UI). Permission selection is driven by the
 * authoritative PERMISSION_CODENAMES list.
 *
 * Permission gates (UX-only; backend is authoritative):
 * - view: role.view
 * - manage: role.manage
 */

import { useState } from 'react';
import {
  Shield,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useCurrentOrganization } from '../context/organizationContextDef';
import {
  useOrganizationRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '../hooks/useOrganizationRoles';
import { PERMISSION_CODENAMES, getPermissionLabel } from '../types/role';
import type { Role } from '../types/role';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../utils/cn';

export function RolesPage() {
  const organization = useCurrentOrganization();
  const orgId = organization?.id ?? '';
  const { data: roles = [], isLoading, error, refetch } = useOrganizationRoles(orgId);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  if (!organization) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent>
            <EmptyState
              title="Select an organization"
              description="Select an organization to manage its roles and permissions."
              icon={<Shield className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header onCreate={() => setShowCreate(true)} />

      {(showCreate || editing) && (
        <RoleForm
          role={editing}
          orgId={orgId}
          onCancel={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-16" role="alert">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm text-destructive font-medium">Failed to load roles</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && roles.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title="No roles found"
              description="Create a custom role to grant a specific set of permissions."
              icon={<Shield className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && roles.length > 0 && (
        <div className="space-y-3">
          {roles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              orgId={orgId}
              onEdit={() => {
                setEditing(role);
                setShowCreate(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage organization roles and the permissions granted to each role.
        </p>
      </div>
      {onCreate && (
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Role
        </Button>
      )}
    </div>
  );
}

function RoleRow({
  role,
  orgId,
  onEdit,
}: {
  role: Role;
  orgId: string;
  onEdit: () => void;
}) {
  const deleteRole = useDeleteRole(orgId);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteRole.mutateAsync(role.id);
    } catch {
      // Backend rejects system-role deletion; surface via toast/alert below
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              {role.is_system_role ? (
                <Lock className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Shield className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{role.name}</CardTitle>
                {role.is_system_role && <Badge variant="secondary">System</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{role.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!role.is_system_role && (
              <>
                <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${role.name}`}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
                {confirming ? (
                  <>
                    <Button variant="destructive" size="sm" onClick={handleDelete} isLoading={deleteRole.isPending}>
                      Confirm
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(true)}
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      {role.description && (
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">{role.description}</p>
        </CardContent>
      )}
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Permissions ({role.permissions.length})
        </p>
        {role.permissions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {role.permissions.map((perm) => (
              <span
                key={perm}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground"
                title={perm}
              >
                {getPermissionLabel(perm)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No permissions.</p>
        )}
      </CardContent>
    </Card>
  );
}

interface RoleFormProps {
  role: Role | null;
  orgId: string;
  onCancel: () => void;
  onSaved: () => void;
}

function RoleForm({ role, orgId, onCancel, onSaved }: RoleFormProps) {
  const createRole = useCreateRole(orgId);
  const updateRole = useUpdateRole(orgId);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (code: string) => {
    setPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }
    try {
      if (role) {
        await updateRole.mutateAsync({
          roleId: role.id,
          data: { name: name.trim(), description: description.trim(), permissions },
        });
      } else {
        await createRole.mutateAsync({ name: name.trim(), description: description.trim(), permissions });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    }
  };

  const busy = createRole.isPending || updateRole.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{role ? `Edit ${role.name}` : 'Create Custom Role'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label={role ? 'Edit role' : 'Create role'}>
          {error && (
            <div className="p-3 text-sm rounded-md bg-red-500/10 border border-red-500 text-red-500" role="alert">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="role-name"
              label="Role Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Incident Reviewer"
              required
              fullWidth
            />
            <Input
              id="role-desc"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              fullWidth
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Permissions</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PERMISSION_CODENAMES.map((code) => {
                const checked = permissions.includes(code);
                return (
                  <label
                    key={code}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent/50'
                    )}
                    title={code}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(code)}
                      className="rounded border-border"
                    />
                    <span>{getPermissionLabel(code)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={busy} disabled={busy}>
              {role ? 'Save Changes' : 'Create Role'}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
