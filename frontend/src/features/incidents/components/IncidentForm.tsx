/**
 * IncidentForm component.
 * 
 * Operational form for creating and managing incidents.
 * Includes:
 * - Incident Information (Title, Description)
 * - Classification (Priority, Category)
 * - Member Assignment (Organization scoped)
 * - SLA & Escalation Configuration (Policy selection, live SLA target preview, escalation levels)
 * - File Attachments (Drag-and-drop, validation, file list)
 * - Responsive, accessible layout
 */

import { useState, useMemo, useRef, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Paperclip,
  Upload,
  X,
  FileText,
  Users,
  Info,
} from 'lucide-react';
import type { Incident, CreateIncidentRequest, UpdateIncidentRequest, IncidentPriority } from '../types/incident.types';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { IncidentPriorityBadge } from './IncidentPriorityBadge';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { useIncidentCategories } from '../hooks/useIncidentCategories';
import { useOrganizationMembers } from '../../organizations/hooks/useOrganizationMembers';
import { useOrganizationRoles } from '../../organizations/hooks/useOrganizationRoles';
import { useSlaPolicies } from '../../sla/hooks/useSlaPolicies';
import { useEscalationPolicies } from '../../sla/hooks/useEscalationPolicies';
import { validateFile, formatFileSize } from '../../collaboration/utils/attachmentUtils';
import { ALLOWED_ATTACHMENT_EXTENSIONS } from '../../collaboration/types/attachment.types';
import { cn } from '../../../utils/cn';

export interface IncidentFormProps {
  incident?: Incident;
  onSubmit: (data: CreateIncidentRequest | UpdateIncidentRequest, stagedFiles?: File[]) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'P1', label: 'P1 — Critical (High Impact / Service Down)' },
  { value: 'P2', label: 'P2 — High (Significant degradation)' },
  { value: 'P3', label: 'P3 — Medium (Moderate impact / workaround exists)' },
  { value: 'P4', label: 'P4 — Low (Minor issue / operational query)' },
];

export function IncidentForm({
  incident,
  onSubmit,
  isLoading = false,
  onCancel,
  submitLabel = 'Create Incident',
  className = '',
}: IncidentFormProps) {
  const organization = useCurrentOrganization();
  const orgId = organization?.id ?? '';

  // Organization-scoped queries
  const { data: categories = [], isLoading: isLoadingCategories } = useIncidentCategories(orgId, true);
  const { data: members = [], isLoading: isLoadingMembers } = useOrganizationMembers(orgId);
  const { data: roles = [] } = useOrganizationRoles(orgId);
  const { data: slaPolicies = [], isLoading: isLoadingSla } = useSlaPolicies(true);
  const { data: escalationPolicies = [], isLoading: isLoadingEscalation } = useEscalationPolicies(true);

  // Form states
  const [title, setTitle] = useState(incident?.title || '');
  const [description, setDescription] = useState(incident?.description || '');
  const [priority, setPriority] = useState<IncidentPriority>(incident?.priority || 'P3');
  const [categoryId, setCategoryId] = useState<string>(incident?.category?.id || '');
  const [assigneeId, setAssigneeId] = useState<string>(incident?.assignee?.id || '');
  const [titleError, setTitleError] = useState('');

  // Policy selection states (for creation & preview)
  const defaultSla = useMemo(() => slaPolicies.find((p) => p.is_default) || slaPolicies[0], [slaPolicies]);
  const defaultEscalation = useMemo(
    () => escalationPolicies.find((p) => p.is_default) || escalationPolicies[0],
    [escalationPolicies]
  );

  const [selectedSlaPolicyId, setSelectedSlaPolicyId] = useState<string>('');
  const [selectedEscalationPolicyId, setSelectedEscalationPolicyId] = useState<string>('');

  // Selected policy objects
  const activeSlaPolicy = useMemo(() => {
    if (selectedSlaPolicyId) {
      return slaPolicies.find((p) => p.id === selectedSlaPolicyId) || null;
    }
    return defaultSla || null;
  }, [selectedSlaPolicyId, slaPolicies, defaultSla]);

  const activeEscalationPolicy = useMemo(() => {
    if (selectedEscalationPolicyId) {
      return escalationPolicies.find((p) => p.id === selectedEscalationPolicyId) || null;
    }
    return defaultEscalation || null;
  }, [selectedEscalationPolicyId, escalationPolicies, defaultEscalation]);

  // SLA Target for current priority
  const currentSlaTarget = useMemo(() => {
    if (!activeSlaPolicy || !activeSlaPolicy.targets) return null;
    return activeSlaPolicy.targets.find((t) => t.priority === priority) || null;
  }, [activeSlaPolicy, priority]);

  // Escalation levels state (which levels are included)
  const [includedLevelNumbers, setIncludedLevelNumbers] = useState<number[]>([]);

  // Staged attachments state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Role lookup map
  const roleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [roles]);

  // Options
  const categoryOptions: SelectOption[] = useMemo(
    () => categories.map((cat) => ({ value: cat.id, label: cat.name })),
    [categories]
  );

  const memberOptions: SelectOption[] = useMemo(
    () =>
      members
        .filter((member) => member.status === 'ACTIVE')
        .map((member) => {
          const name = `${member.user.first_name || ''} ${member.user.last_name || ''}`.trim();
          const displayName = name ? `${name} (${member.user.email})` : member.user.email;
          const roleLabel = member.role?.name ? ` — ${member.role.name}` : '';
          return {
            value: member.id,
            label: `${displayName}${roleLabel}`,
          };
        }),
    [members]
  );

  const slaOptions: SelectOption[] = useMemo(
    () =>
      slaPolicies.map((policy) => ({
        value: policy.id,
        label: `${policy.name}${policy.is_default ? ' (Default)' : ''}`,
      })),
    [slaPolicies]
  );

  const escalationOptions: SelectOption[] = useMemo(
    () =>
      escalationPolicies.map((policy) => ({
        value: policy.id,
        label: `${policy.name}${policy.is_default ? ' (Default)' : ''}`,
      })),
    [escalationPolicies]
  );

  // Attachment handling
  const handleAddFiles = (files: FileList | File[]) => {
    setFileError(null);
    const newFiles: File[] = [];
    let errorFound = false;

    Array.from(files).forEach((file) => {
      const validation = validateFile(file);
      if (!validation.ok) {
        setFileError(`${file.name}: ${validation.error}`);
        errorFound = true;
        return;
      }
      // Check duplicate
      const alreadyAdded = stagedFiles.some((f) => f.name === file.name && f.size === file.size);
      if (!alreadyAdded) {
        newFiles.push(file);
      }
    });

    if (!errorFound) {
      setFileError(null);
    }
    if (newFiles.length > 0) {
      setStagedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleLevel = (levelNumber: number) => {
    setIncludedLevelNumbers((prev) =>
      prev.includes(levelNumber) ? prev.filter((l) => l !== levelNumber) : [...prev, levelNumber]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError('Incident title is required');
      const titleElem = document.getElementById('title');
      titleElem?.focus();
      return;
    }

    setTitleError('');

    const data: CreateIncidentRequest = {
      title: title.trim(),
      description: description.trim(),
      priority,
      category_id: categoryId || null,
      assignee_id: assigneeId || null,
    };

    onSubmit(data, stagedFiles);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-8', className)} noValidate>
      {/* 1. Incident Information Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Incident Information</CardTitle>
          </div>
          <CardDescription>
            Provide a clear summary and detailed description of the incident.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              id="title"
              label="Incident Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) setTitleError('');
              }}
              error={titleError}
              placeholder="e.g., Payment Gateway 502 Bad Gateway Spike"
              fullWidth
              required
              aria-required="true"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              A concise, descriptive summary of the problem.
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1.5 text-foreground">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail symptoms, customer impact, error logs, and any preliminary observations..."
              rows={5}
              className={cn(
                'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Classification Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Classification</CardTitle>
          </div>
          <CardDescription>
            Categorize severity and domain to determine operational urgency and SLA targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Select
                id="priority"
                label="Priority Severity"
                value={priority}
                onChange={(e) => setPriority(e.target.value as IncidentPriority)}
                options={PRIORITY_OPTIONS}
                fullWidth
                required
              />
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active Badge:</span>
                <IncidentPriorityBadge priority={priority} />
              </div>
            </div>

            <div>
              <Select
                id="category"
                label="Incident Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={[{ value: '', label: 'No category' }, ...categoryOptions]}
                fullWidth
                disabled={isLoadingCategories}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Classifies the operational component (e.g. Infrastructure, Database, API).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Assignment Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Assignment</CardTitle>
          </div>
          <CardDescription>
            Assign the incident to an active organization member for primary response.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Select
              id="assignee"
              label="Primary Assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              options={[{ value: '', label: 'Unassigned (Triage pool)' }, ...memberOptions]}
              fullWidth
              disabled={isLoadingMembers}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Only active members of this organization can be assigned.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. SLA & Escalation Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-lg">SLA & Escalation Strategy</CardTitle>
          </div>
          <CardDescription>
            Review governing service level agreements and automated escalation rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SLA Policy selector & Live preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="sla-policy" className="text-sm font-medium text-foreground">
                Service Level Agreement (SLA) Policy
              </label>
              {activeSlaPolicy?.is_default && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Default Organization Policy
                </span>
              )}
            </div>

            {slaPolicies.length === 0 && !isLoadingSla ? (
              <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                No SLA policies configured for this organization. The incident will be created without SLA tracking.
              </div>
            ) : (
              <Select
                id="sla-policy"
                value={selectedSlaPolicyId || activeSlaPolicy?.id || ''}
                onChange={(e) => setSelectedSlaPolicyId(e.target.value)}
                options={slaOptions}
                fullWidth
                disabled={isLoadingSla}
              />
            )}

            {/* Live SLA Target Card for selected priority */}
            {currentSlaTarget ? (
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span>Targets for {priority} Severity</span>
                  <span className="text-muted-foreground font-normal">{activeSlaPolicy?.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Response Target</span>
                    <span className="font-semibold text-foreground">
                      {currentSlaTarget.response_time_minutes} minutes
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Resolution Target</span>
                    <span className="font-semibold text-foreground">
                      {currentSlaTarget.resolution_time_minutes >= 60
                        ? `${(currentSlaTarget.resolution_time_minutes / 60).toFixed(1)} hours`
                        : `${currentSlaTarget.resolution_time_minutes} minutes`}
                    </span>
                  </div>
                </div>
              </div>
            ) : activeSlaPolicy ? (
              <p className="text-xs text-muted-foreground italic">
                No specific targets configured for {priority} in policy &quot;{activeSlaPolicy.name}&quot;.
              </p>
            ) : null}
          </div>

          <hr className="border-border" />

          {/* Escalation Policy & Levels */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="escalation-policy" className="text-sm font-medium text-foreground">
                Escalation Policy
              </label>
              {activeEscalationPolicy?.is_default && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Default Escalation Policy
                </span>
              )}
            </div>

            {escalationPolicies.length === 0 && !isLoadingEscalation ? (
              <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                No escalation policies configured. Automated escalation will not be triggered on breach.
              </div>
            ) : (
              <Select
                id="escalation-policy"
                value={selectedEscalationPolicyId || activeEscalationPolicy?.id || ''}
                onChange={(e) => {
                  setSelectedEscalationPolicyId(e.target.value);
                  setIncludedLevelNumbers([]);
                }}
                options={escalationOptions}
                fullWidth
                disabled={isLoadingEscalation}
              />
            )}

            {/* Escalation Levels Preview */}
            {activeEscalationPolicy && activeEscalationPolicy.levels && activeEscalationPolicy.levels.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Configured Escalation Hierarchy ({activeEscalationPolicy.levels.length} Level{activeEscalationPolicy.levels.length > 1 ? 's' : ''})
                </span>
                <div className="space-y-2">
                  {activeEscalationPolicy.levels.map((level) => {
                    const roleName =
                      level.target_type === 'ROLE'
                        ? roleNameMap.get(level.target_reference) || 'Designated Role'
                        : 'Current Assignee';

                    const isChecked =
                      includedLevelNumbers.length === 0 || includedLevelNumbers.includes(level.level);

                    return (
                      <div
                        key={level.id || level.level}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border text-sm transition-colors',
                          isChecked ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`level-${level.level}`}
                            checked={isChecked}
                            onChange={() => toggleLevel(level.level)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                            aria-label={`Include escalation level ${level.level}`}
                          />
                          <label htmlFor={`level-${level.level}`} className="cursor-pointer select-none">
                            <span className="font-semibold text-foreground block">
                              Level {level.level}: {level.name || `Escalate to ${roleName}`}
                            </span>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>Target: {roleName}</span>
                              <span>•</span>
                              <span>Delay: {level.delay_minutes} min after breach</span>
                            </div>
                          </label>
                        </div>
                        <ShieldAlert className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. Attachments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">Incident Attachments</CardTitle>
          </div>
          <CardDescription>
            Attach diagnostic files, screenshots, error logs, or relevant documents (max 10MB per file).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Upload files for this incident. Click or drag and drop files here."
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(',')}
              className="hidden"
              aria-hidden="true"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                <span className="text-primary hover:underline">Click to browse</span> or drag and drop files here
              </p>
              <p className="text-xs text-muted-foreground">
                Supported: {ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')} (up to 10MB each)
              </p>
            </div>
          </div>

          {/* Validation error */}
          {fileError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Staged file list */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Staged for upload ({stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''})
              </span>
              <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden" role="list">
                {stagedFiles.map((file, idx) => (
                  <li
                    key={`${file.name}-${file.size}-${idx}`}
                    className="flex items-center justify-between p-3 bg-card hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Remove file ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Action Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        ) : (
          <div />
        )}

        <Button
          type="submit"
          isLoading={isLoading}
          disabled={isLoading}
          size="lg"
          className="min-w-[180px]"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
