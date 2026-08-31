/**
 * IncidentForm component.
 * 
 * Form for creating and editing incidents.
 * Includes validation and handles submission.
 */

import { useState } from 'react';
import type { Incident, CreateIncidentRequest, UpdateIncidentRequest, IncidentPriority } from '../types/incident.types';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { IncidentPriorityBadge } from './IncidentPriorityBadge';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { useIncidentCategories } from '../hooks/useIncidentCategories';
import { useOrganizationMembers } from '../../organizations/hooks/useOrganizationMembers';

interface IncidentFormProps {
  incident?: Incident;
  onSubmit: (data: CreateIncidentRequest | UpdateIncidentRequest) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'P1', label: 'P1 — Critical' },
  { value: 'P2', label: 'P2 — High' },
  { value: 'P3', label: 'P3 — Medium' },
  { value: 'P4', label: 'P4 — Low' },
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
  const { data: categories = [] } = useIncidentCategories(orgId, true);
  const { data: members = [] } = useOrganizationMembers(orgId);
  const [title, setTitle] = useState(incident?.title || '');
  const [description, setDescription] = useState(incident?.description || '');
  const [priority, setPriority] = useState<IncidentPriority>(incident?.priority || 'P3');
  const [categoryId, setCategoryId] = useState<string>(incident?.category?.id || '');
  const [assigneeId, setAssigneeId] = useState<string>(incident?.assignee?.id || '');
  const [titleError, setTitleError] = useState('');

  const categoryOptions: SelectOption[] = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));

  const memberOptions: SelectOption[] = members
    .filter((member) => member.status === 'ACTIVE')
    .map((member) => ({
      value: member.id,
      label: `${member.user.first_name || member.user.email} ${member.user.last_name}`.trim(),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      setTitleError('Incident title is required');
      return;
    }

    setTitleError('');

    const data: CreateIncidentRequest | UpdateIncidentRequest = {
      title: title.trim(),
      description: description.trim(),
      priority,
      category_id: categoryId || null,
      assignee_id: assigneeId || null,
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      <div>
        <Input
          id="title"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={titleError}
          placeholder="Enter incident title"
          fullWidth
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1.5">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the incident details"
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div>
        <Select
          id="priority"
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as IncidentPriority)}
          options={PRIORITY_OPTIONS}
          fullWidth
        />
        <div className="mt-2">
          <IncidentPriorityBadge priority={priority} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <Select
            id="category"
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[{ value: '', label: 'No category' }, ...categoryOptions]}
            fullWidth
          />
        </div>

        <div>
          <Select
            id="assignee"
            label="Assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            options={[{ value: '', label: 'Unassigned' }, ...memberOptions]}
            fullWidth
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={isLoading}
        >
          {submitLabel}
        </Button>
        
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
