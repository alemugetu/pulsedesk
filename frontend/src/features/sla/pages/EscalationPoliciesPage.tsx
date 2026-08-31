/**
 * EscalationPoliciesPage component.
 *
 * Escalation policy management page for PulseDesk.
 *
 * Displays a list of escalation policies with create/edit capability, inline
 * management of escalation levels, and rule creation. All data is scoped to
 * the current organization and reads/writes flow through the real backend
 * Escalation API.
 *
 * Permission gates (UX-only; backend is authoritative):
 * - view: escalation.view
 * - manage: escalation.manage
 */

import { useState } from 'react';
import { Plus, Siren, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { useEscalationPolicies } from '../hooks/useEscalationPolicies';
import {
  createEscalationPolicy,
  updateEscalationPolicy,
  createEscalationLevel,
  updateEscalationLevel,
  createEscalationRule,
} from '../services/escalationService';
import type { EscalationPolicy, EscalationLevel } from '../types/escalation.types';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useQueryClient } from '@tanstack/react-query';

const TARGET_TYPE_OPTIONS = [
  { value: 'ASSIGNEE', label: 'Current Assignee' },
  { value: 'ROLE', label: 'Role' },
];

const TRIGGER_OPTIONS = [
  { value: 'RESPONSE_BREACH', label: 'Response Breach' },
  { value: 'RESOLUTION_BREACH', label: 'Resolution Breach' },
];

export function EscalationPoliciesPage() {
  const organization = useCurrentOrganization();
  const { data: policies, isLoading, error, refetch } = useEscalationPolicies();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EscalationPolicy | null>(null);
  const canManage = !!organization;

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card>
          <CardContent>
            <EmptyState
              title="Select an organization"
              description="Select an organization to manage its escalation policies."
              icon={<Siren className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader onCreate={() => setShowCreate(true)} canManage={canManage} />

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
          <p className="text-sm text-destructive font-medium">Failed to load escalation policies</p>
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
              title="No escalation policies found"
              description="Create an escalation policy to define escalation levels and trigger rules."
              icon={<Siren className="h-8 w-8" aria-hidden="true" />}
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
              canManage={canManage}
              onEdit={() => {
                setEditingPolicy(policy);
                setShowCreate(false);
              }}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['escalation-policies', organization.id] });
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
        <h1 className="text-2xl font-bold text-foreground">Escalation Policies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define escalation levels and trigger rules for incidents.
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
  policy: EscalationPolicy | null;
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
        await updateEscalationPolicy(organization.id, policy.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
          is_default: isDefault,
        });
      } else {
        await createEscalationPolicy(organization.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
          is_default: isDefault,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['escalation-policies', organization.id] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save escalation policy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{policy ? 'Edit Escalation Policy' : 'Create Escalation Policy'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label={policy ? 'Edit escalation policy' : 'Create escalation policy'}>
          {error && (
            <div className="p-3 text-sm rounded-md bg-red-500/10 border border-red-500 text-red-500" role="alert">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="esc-name"
              label="Policy Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Escalation"
              required
              fullWidth
            />
            <Input
              id="esc-desc"
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
  policy: EscalationPolicy;
  canManage: boolean;
  onEdit: () => void;
  onChanged: () => void;
}

function PolicyRow({ policy, canManage, onEdit, onChanged }: PolicyRowProps) {
  const [addingLevel, setAddingLevel] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EscalationLevel | null>(null);
  const [addingRule, setAddingRule] = useState(false);

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
      <CardContent className="space-y-6">
        {/* Levels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Levels ({policy.levels.length})
            </h3>
            {canManage && !addingLevel && !editingLevel && (
              <Button variant="ghost" size="sm" onClick={() => setAddingLevel(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Level
              </Button>
            )}
          </div>

          {(addingLevel || editingLevel) && (
            <LevelForm
              policyId={policy.id}
              level={editingLevel}
              nextLevelNumber={(policy.levels.length > 0
                ? Math.max(...policy.levels.map((l) => l.level))
                : 0) + 1}
              onCancel={() => {
                setAddingLevel(false);
                setEditingLevel(null);
              }}
              onSaved={() => {
                setAddingLevel(false);
                setEditingLevel(null);
                onChanged();
              }}
            />
          )}

          {policy.levels.length > 0 ? (
            <div className="space-y-2">
              {[...policy.levels]
                .sort((a, b) => a.level - b.level)
                .map((level) => (
                  <div
                    key={level.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
                        {level.level}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{level.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Delay: {formatDelay(level.delay_minutes)} · Target: {formatTarget(level.target_type, level.target_reference)}
                        </p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLevel(level);
                            setAddingLevel(false);
                          }}
                          aria-label={`Edit level ${level.level}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No levels configured for this policy.</p>
          )}
        </div>

        {/* Rules */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Trigger Rules ({policy.rules.length})
            </h3>
            {canManage && !addingRule && (
              <Button variant="ghost" size="sm" onClick={() => setAddingRule(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Rule
              </Button>
            )}
          </div>

          {addingRule && (
            <RuleForm
              policyId={policy.id}
              existingTriggers={policy.rules.map((r) => r.trigger_type)}
              onCancel={() => setAddingRule(false)}
              onSaved={() => {
                setAddingRule(false);
                onChanged();
              }}
            />
          )}

          {policy.rules.length > 0 ? (
            <div className="space-y-2">
              {policy.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                >
                  <span className="font-medium">{rule.trigger_type}</span>
                  <span className={rule.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No trigger rules configured. Rules determine when escalation triggers.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDelay(delayMinutes: number): string {
  if (delayMinutes === 0) return 'Immediate';
  if (delayMinutes < 60) return `${delayMinutes}m`;
  const h = Math.floor(delayMinutes / 60);
  const m = delayMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTarget(targetType: string, ref: string): string {
  if (targetType === 'ASSIGNEE') return 'Current Assignee';
  if (targetType === 'ROLE' && ref) return `Role`;
  return targetType;
}

interface LevelFormProps {
  policyId: string;
  level: EscalationLevel | null;
  nextLevelNumber: number;
  onCancel: () => void;
  onSaved: () => void;
}

function LevelForm({ policyId, level, nextLevelNumber, onCancel, onSaved }: LevelFormProps) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [levelNum, setLevelNum] = useState(level?.level?.toString() ?? nextLevelNumber.toString());
  const [name, setName] = useState(level?.name ?? '');
  const [delay, setDelay] = useState(level?.delay_minutes?.toString() ?? '0');
  const [targetType, setTargetType] = useState<EscalationLevel['target_type']>(level?.target_type ?? 'ASSIGNEE');
  const [targetReference, setTargetReference] = useState(level?.target_reference ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    setError(null);
    const lvl = Number(levelNum);
    const delayMin = Number(delay);
    if (!name.trim()) {
      setError('Level name is required');
      return;
    }
    if (!lvl || lvl < 1) {
      setError('Level number must be a positive integer');
      return;
    }
    if (targetType === 'ROLE' && !targetReference.trim()) {
      setError('A role reference is required when target type is Role.');
      return;
    }
    setSubmitting(true);
    try {
      if (level) {
        await updateEscalationLevel(organization.id, policyId, level.id, {
          name: name.trim(),
          delay_minutes: Number.isNaN(delayMin) || delayMin < 0 ? 0 : delayMin,
          target_type: targetType,
          target_reference: targetReference.trim(),
        });
      } else {
        await createEscalationLevel(organization.id, policyId, {
          level: lvl,
          name: name.trim(),
          delay_minutes: Number.isNaN(delayMin) || delayMin < 0 ? 0 : delayMin,
          target_type: targetType,
          target_reference: targetReference.trim(),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['escalation-policies', organization.id] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save escalation level');
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
        <Input
          id={`lvl-num-${policyId}`}
          label="Level #"
          type="number"
          min={1}
          value={levelNum}
          onChange={(e) => setLevelNum(e.target.value)}
          disabled={!!level}
          fullWidth
        />
        <div className="sm:col-span-1">
          <Input
            id={`lvl-name-${policyId}`}
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. First responders"
            fullWidth
          />
        </div>
        <Input
          id={`lvl-delay-${policyId}`}
          label="Delay (min)"
          type="number"
          min={0}
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          fullWidth
        />
        <div className="grid grid-cols-1 gap-3">
          <Select
            id={`lvl-target-${policyId}`}
            label="Target"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as EscalationLevel['target_type'])}
            options={TARGET_TYPE_OPTIONS}
            fullWidth
          />
          {targetType === 'ROLE' && (
            <Input
              id={`lvl-ref-${policyId}`}
              label="Role ID"
              value={targetReference}
              onChange={(e) => setTargetReference(e.target.value)}
              placeholder="Role UUID"
              fullWidth
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" isLoading={submitting} disabled={submitting}>Save</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

interface RuleFormProps {
  policyId: string;
  existingTriggers: string[];
  onCancel: () => void;
  onSaved: () => void;
}

function RuleForm({ policyId, existingTriggers, onCancel, onSaved }: RuleFormProps) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [triggerType, setTriggerType] = useState('RESPONSE_BREACH');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const options = TRIGGER_OPTIONS.map((opt) => ({
    ...opt,
    disabled: existingTriggers.includes(opt.value),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    setError(null);
    setSubmitting(true);
    try {
      await createEscalationRule(organization.id, policyId, {
        trigger_type: triggerType as 'RESPONSE_BREACH' | 'RESOLUTION_BREACH',
        is_active: isActive,
      });
      queryClient.invalidateQueries({ queryKey: ['escalation-policies', organization.id] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id={`rule-trigger-${policyId}`}
          label="Trigger Type"
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value)}
          options={options}
          fullWidth
        />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            Active
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" isLoading={submitting} disabled={submitting}>Add Rule</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
