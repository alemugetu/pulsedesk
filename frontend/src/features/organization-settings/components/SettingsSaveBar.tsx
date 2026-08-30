/**
 * SettingsSaveBar component - save/cancel controls for settings forms.
 * 
 * Provides consistent action bar with save, cancel, and status indicators
 * for settings forms with dirty state tracking.
 */

import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';

interface SettingsSaveBarProps {
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Whether the form is currently saving */
  isSaving: boolean;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Save button label */
  saveLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Save handler */
  onSave: () => void;
  /** Cancel handler */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Success message to display */
  successMessage?: string | null;
}

export function SettingsSaveBar({
  hasChanges,
  isSaving,
  disabled = false,
  saveLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  onSave,
  onCancel,
  className,
  successMessage,
}: SettingsSaveBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-t border-border bg-surface p-4',
        className
      )}
    >
      <div className="flex-1">
        {successMessage && (
          <p className="text-sm text-green-500">{successMessage}</p>
        )}
        {!successMessage && hasChanges && (
          <p className="text-sm text-muted-foreground">You have unsaved changes</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={disabled || isSaving || !hasChanges}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={disabled || isSaving || !hasChanges}
          isLoading={isSaving}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
