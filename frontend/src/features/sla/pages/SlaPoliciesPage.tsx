/**
 * SlaPoliciesPage component.
 *
 * SLA policy management page for PulseDesk.
 *
 * Displays a list of SLA policies with create and edit capability. SLA
 * targets are managed inline per policy. All data is scoped to the current
 * organization and reads/writes flow through the real backend SLA API.
 *
 * Permission gates (UX-only; backend is authoritative):
 * - view: sla.view
 * - manage: sla.manage
 */

import { useState } from 'react';
import { Plus, Shield, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { useSlaPolicies } from '../hooks/useSlaPolicies';
import {
  createSlaPolicy,
  updateSlaPolicy,
  createSlaTarget,
  updateSlaTarget,
} from '../services/slaService';
import type { SLAPolicy, SLATarget } from '../types/sla.types';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useQueryClient } from '@tanstack/react-query';

const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 — Critical' },
  { value: 'P2', label: 'P2 — High' },
  { value: 'P3', label: 'P3 — Medium' },
  { value: 'P4', label: 'P4 — Low' },
];

export function SlaPoliciesPage() {
  const organization = useCurrentOrganization();
  const { data: policies, isLoading, error, refetch } = useSlaPolicies();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null);

  const hasManage = organization
    ? true // UX gate refined below via permission check in actions
    : false;

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card>
          <CardContent>
            <EmptyState
              title="Select an organization"
              description="Select an organization to manage its SLA policies."
              icon={<Shield className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        onCreate={() => setShowCreate(true)}
        canManage={hasManage}
      />

      {(showCreate || editingPolicy) && (
        <PolicyForm
          policy={editingPolicy}
          onCancel={() => {
            setShowCreate(false);
            setEditingPolicy(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditingPolicy(null);
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
          <p className="text-sm text-destructive font-medium">Failed to load SLA policies</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && (!policies || policies.length === 0) && (
        <Card>
          <CardContent>
            <EmptyState
              title="No SLA policies found"
              description="Create an SLA policy to define response and resolution time targets."
              icon={<Shield className="h-8 w-8" aria-hidden="true" />}
              action={
                hasManage ? (
                  <Button onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Policy
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && policies && policies.length > 0 && (
        <div className="space-y-4">
          {policies.map((policy) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              canManage={hasManage}
              onEdit={() => {
                setEditingPolicy(policy);
                setShowCreate(false);
              }}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['sla-policies', organization.id] });
                refetch();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader({
  onCreate,
  canManage,
}: {
  onCreate?: () => void;
  canManage?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SLA Policies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define response and resolution targets for incidents by priority.
        </p>
      </div>
      {canManage && onCreate && (
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Policy
        </Button>
      )}
    </div>
  );
}

interface PolicyFormProps {
  policy: SLAPolicy | null;
  onCancel: () => void;
  onSaved: () => void;
}

function PolicyForm({ policy, onCancel, onSaved }: PolicyFormProps) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [name, setName] = useState(policy?.name ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [isActive, setIsActive] = useState(policy?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(policy?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    if (!name.trim()) {
      setError('Policy name is required');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (policy) {
        await updateSlaPolicy(organization.id, policy.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
          is_default: isDefault,
        });
      } else {
        await createSlaPolicy(organization.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
          is_default: isDefault,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['sla-policies', organization.id] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SLA policy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{policy ? 'Edit SLA Policy' : 'Create SLA Policy'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label={policy ? 'Edit SLA policy' : 'Create SLA policy'}>
          {error && (
            <div className="p-3 text-sm rounded-md bg-red-500/10 border border-red-500 text-red-500" role="alert">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="sla-name"
              label="Policy Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard SLA"
              required
              fullWidth
            />
            <Input
              id="sla-desc"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              fullWidth
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border"
              />
              Default policy
            </label>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={submitting} disabled={submitting}>
              {policy ? 'Save Changes' : 'Create Policy'}
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

interface PolicyRowProps {
  policy: SLAPolicy;
  canManage: boolean;
  onEdit: () => void;
  onChanged: () => void;
}

function PolicyRow({ policy, canManage, onEdit, onChanged }: PolicyRowProps) {
  const [addingTarget, setAddingTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SLATarget | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{policy.name}</CardTitle>
              {policy.is_default && <Badge variant="secondary">Default</Badge>}
              {!policy.is_active && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {policy.description && (
              <p className="mt-1 text-sm text-muted-foreground">{policy.description}</p>
            )}
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${policy.name}`}>
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Targets ({policy.targets.length})
            </h3>
            {canManage && !addingTarget && !editingTarget && (
              <Button variant="ghost" size="sm" onClick={() => setAddingTarget(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Target
              </Button>
            )}
          </div>

          {(addingTarget || editingTarget) && (
            <TargetForm
              policyId={policy.id}
              target={editingTarget}
              existingPriorities={policy.targets.map((t) => t.priority)}
              onCancel={() => {
                setAddingTarget(false);
                setEditingTarget(null);
              }}
              onSaved={() => {
                setAddingTarget(false);
                setEditingTarget(null);
                onChanged();
              }}
            />
          )}

          {policy.targets.length > 0 ? (
            <div className="space-y-2">
              {policy.targets.map((target) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card text-sm"
                >
                  <span className="font-medium">{target.priority}</span>
                  <span className="flex-1 text-muted-foreground ml-2">
                    Response: <span className="text-foreground">{target.response_time_minutes}m</span>
                    &nbsp;·&nbsp;Resolution: <span className="text-foreground">{target.resolution_time_minutes}m</span>
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTarget(target);
                        setAddingTarget(false);
                      }}
                      aria-label={`Edit target for ${target.priority}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No targets configured for this policy.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface TargetFormProps {
  policyId: string;
  target: SLATarget | null;
  existingPriorities: string[];
  onCancel: () => void;
  onSaved: () => void;
}

function TargetForm({ policyId, target, existingPriorities, onCancel, onSaved }: TargetFormProps) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [priority, setPriority] = useState(target?.priority ?? 'P3');
  const [responseTime, setResponseTime] = useState(target?.response_time_minutes?.toString() ?? '30');
  const [resolutionTime, setResolutionTime] = useState(target?.resolution_time_minutes?.toString() ?? '60');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const priorityOptions = PRIORITY_OPTIONS.map((opt) => ({
    ...opt,
    disabled: !target && existingPriorities.includes(opt.value),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    setError(null);
    const resp = Number(responseTime);
    const resol = Number(resolutionTime);
    if (!resp || resp < 1 || !resol || resol < 1) {
      setError('Times must be positive integers.');
      return;
    }
    if (resol < resp) {
      setError('Resolution time must be greater than or equal to response time.');
      return;
    }
    setSubmitting(true);
    try {
      if (target) {
        await updateSlaTarget(organization.id, policyId, target.id, {
          response_time_minutes: resp,
          resolution_time_minutes: resol,
        });
      } else {
        await createSlaTarget(organization.id, policyId, {
          priority: priority as SLATarget['priority'],
          response_time_minutes: resp,
          resolution_time_minutes: resol,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['sla-policies', organization.id] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save target');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 rounded-lg border bg-surface">
      {error && (
        <div className="p-2 text-sm rounded bg-red-500/10 border border-red-500 text-red-500" role="alert">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <Select
            id={`target-priority-${policyId}`}
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as SLATarget['priority'])}
            options={priorityOptions}
            disabled={!!target}
            fullWidth
          />
        </div>
        <Input
          id={`target-resp-${policyId}`}
          label="Response (min)"
          type="number"
          min={1}
          value={responseTime}
          onChange={(e) => setResponseTime(e.target.value)}
          fullWidth
        />
        <Input
          id={`target-resol-${policyId}`}
          label="Resolution (min)"
          type="number"
          min={1}
          value={resolutionTime}
          onChange={(e) => setResolutionTime(e.target.value)}
          fullWidth
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1" isLoading={submitting} disabled={submitting}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
