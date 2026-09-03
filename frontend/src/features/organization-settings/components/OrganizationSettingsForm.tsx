/**
 * OrganizationSettingsForm component - main form for managing organization settings.
 * 
 * Responsibilities:
 * - Manage editable settings state
 * - Validate fields according to backend rules
 * - Submit PATCH requests
 * - Display validation errors
 * - Prevent invalid submissions
 * - Track dirty/saved state
 * 
 * Backend permissions:
 * - View: settings.view
 * - Edit: settings.manage
 */

import { useState, useEffect, useRef } from 'react';
import { Select } from '../../../components/ui/Select';
import { SettingsSection } from './SettingsSection';
import { SettingsField } from './SettingsField';
import { SettingsSaveBar } from './SettingsSaveBar';
import type {
  OrganizationSettings,
  OrganizationSettingsUpdateRequest,
  IncidentPriority,
  IncidentStatus,
} from '../types/organizationSettings.types';
import {
  INCIDENT_PRIORITY_CHOICES,
  INCIDENT_STATUS_CHOICES,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_STATUS_LABELS,
} from '../types/organizationSettings.types';
import { areSettingsEqual, getChangedFields, formatSettingsError } from '../utils/organizationSettingsUtils';

interface OrganizationSettingsFormProps {
  /** Current settings from server */
  settings: OrganizationSettings;
  /** Whether user has manage permission */
  canManage: boolean;
  /** Save handler */
  onSave: (data: OrganizationSettingsUpdateRequest) => Promise<void>;
  /** Whether currently saving */
  isSaving: boolean;
  /** Save error from server */
  saveError?: unknown;
}

export function OrganizationSettingsForm({
  settings,
  canManage,
  onSave,
  isSaving,
  saveError,
}: OrganizationSettingsFormProps) {
  // Local form state
  const [formData, setFormData] = useState<Partial<OrganizationSettingsUpdateRequest>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset form when settings change (e.g., after organization switch)
  const prevSettingsIdRef = useRef<string | undefined>(settings.id);
  useEffect(() => {
    if (prevSettingsIdRef.current !== settings.id) {
      setFormData({});
      setShowSuccess(false);
      prevSettingsIdRef.current = settings.id;
    }
  }, [settings.id]);

  // Check if form has unsaved changes
  const hasChanges = !areSettingsEqual(settings, formData);

  // Handle field change
  const handleFieldChange = <K extends keyof OrganizationSettingsUpdateRequest>(
    field: K,
    value: OrganizationSettingsUpdateRequest[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setShowSuccess(false);
  };

  // Handle save
  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    const changedFields = getChangedFields(settings, formData);
    if (Object.keys(changedFields).length === 0) return;

    try {
      await onSave(changedFields);
      setFormData({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      // Error is handled by parent component via saveError prop
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({});
    setShowSuccess(false);
  };

  // Get current value or fall back to original
  const getValue = <K extends keyof OrganizationSettingsUpdateRequest>(
    field: K
  ): OrganizationSettingsUpdateRequest[K] => {
    if (formData[field] !== undefined) {
      return formData[field];
    }
    return settings[field];
  };

  return (
    <div className="space-y-6">
      {/* Incident Settings Section */}
      <SettingsSection
        title="Incident Settings"
        description="Configure default values and behavior for new incidents"
      >
        <SettingsField
          label="Default Priority"
          description="Priority assigned to newly created incidents"
          disabled={!canManage}
        >
          <Select
            value={getValue('default_incident_priority')}
            onChange={(e) => handleFieldChange('default_incident_priority', e.target.value as IncidentPriority)}
            disabled={!canManage}
            options={INCIDENT_PRIORITY_CHOICES.map((priority) => ({
              value: priority,
              label: INCIDENT_PRIORITY_LABELS[priority],
            }))}
          />
        </SettingsField>

        <SettingsField
          label="Default Status"
          description="Status assigned to newly created incidents"
          disabled={!canManage}
        >
          <Select
            value={getValue('default_incident_status')}
            onChange={(e) => handleFieldChange('default_incident_status', e.target.value as IncidentStatus)}
            disabled={!canManage}
            options={INCIDENT_STATUS_CHOICES.map((status) => ({
              value: status,
              label: INCIDENT_STATUS_LABELS[status],
            }))}
          />
        </SettingsField>

        <SettingsField
          label="Enable Comments"
          description="Allow comments on incidents within this organization"
          disabled={!canManage}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="incident_comments_enabled"
              checked={getValue('incident_comments_enabled') as boolean}
              onChange={(e) => handleFieldChange('incident_comments_enabled', e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring"
            />
            <label htmlFor="incident_comments_enabled" className="text-sm text-foreground">
              Enabled
            </label>
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Notification Settings Section */}
      <SettingsSection
        title="Notification Settings"
        description="Configure email notifications for incidents, escalations, and SLA events"
      >
        <SettingsField
          label="Incident Email Notifications"
          description="Send email notifications for incident updates"
          disabled={!canManage}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notification_incident_emails_enabled"
              checked={getValue('notification_incident_emails_enabled') as boolean}
              onChange={(e) => handleFieldChange('notification_incident_emails_enabled', e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring"
            />
            <label htmlFor="notification_incident_emails_enabled" className="text-sm text-foreground">
              Enabled
            </label>
          </div>
        </SettingsField>

        <SettingsField
          label="Escalation Email Notifications"
          description="Send email notifications when escalations trigger"
          disabled={!canManage}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notification_escalation_emails_enabled"
              checked={getValue('notification_escalation_emails_enabled') as boolean}
              onChange={(e) => handleFieldChange('notification_escalation_emails_enabled', e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring"
            />
            <label htmlFor="notification_escalation_emails_enabled" className="text-sm text-foreground">
              Enabled
            </label>
          </div>
        </SettingsField>

        <SettingsField
          label="SLA Email Notifications"
          description="Send email notifications for SLA warnings and breaches"
          disabled={!canManage}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notification_sla_emails_enabled"
              checked={getValue('notification_sla_emails_enabled') as boolean}
              onChange={(e) => handleFieldChange('notification_sla_emails_enabled', e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring"
            />
            <label htmlFor="notification_sla_emails_enabled" className="text-sm text-foreground">
              Enabled
            </label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="SLA Settings"
        description="Configure default SLA policy behavior"
      >
        <SettingsField
          label="Auto-Apply Default SLA Policy"
          description="Automatically apply the organization's default active SLA policy to new incidents"
          disabled={!canManage}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sla_auto_apply_default_policy"
              checked={getValue('sla_auto_apply_default_policy') as boolean}
              onChange={(e) => handleFieldChange('sla_auto_apply_default_policy', e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring"
            />
            <label htmlFor="sla_auto_apply_default_policy" className="text-sm text-foreground">
              Enabled
            </label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Escalation Settings"
        description="Configure default escalation policy behavior"
      >
        <SettingsField
          label="Auto-Evaluate Default Escalation Policy"
          description="Automatically evaluate the organization's default active escalation policy for SLA breaches"
          disabled={!canManage}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="escalation_auto_apply_default_policy"
              checked={getValue('escalation_auto_apply_default_policy') as boolean}
              onChange={(e) => handleFieldChange('escalation_auto_apply_default_policy', e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring"
            />
            <label htmlFor="escalation_auto_apply_default_policy" className="text-sm text-foreground">
              Enabled
            </label>
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Error Display */}
      {Boolean(saveError) && (
        <div className="rounded-md border border-red-500 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{String(formatSettingsError(saveError))}</p>
        </div>
      )}

      {/* Save Bar */}
      {canManage && (
        <SettingsSaveBar
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={handleCancel}
          successMessage={showSuccess ? 'Settings saved successfully' : null}
        />
      )}
    </div>
  );
}
