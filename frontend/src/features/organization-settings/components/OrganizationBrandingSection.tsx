/**
 * OrganizationBrandingSection Component.
 *
 * Professional branding management section in Organization Settings:
 * - Displays current company logo with aspect-ratio preservation
 * - Supports instant file preview before saving
 * - Enforces file type and 2MB size limit validation
 * - Supports removal with an accessible confirmation dialog
 * - RBAC permission gated (requires settings.manage)
 */

import { useState, useRef, type ChangeEvent } from 'react';
import { Upload, Trash2, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { useOrganizationBranding } from '../../organizations/hooks/useOrganizationBranding';
import { validateLogoFile, readFileAsDataUrl } from '../../organizations/services/brandingService';
import { ACCEPTED_LOGO_EXTENSIONS } from '../../organizations/types/branding.types';

interface OrganizationBrandingSectionProps {
  organizationId?: string;
  organizationName?: string;
  canManage: boolean;
  className?: string;
}

export function OrganizationBrandingSection({
  organizationId,
  organizationName = 'Organization',
  canManage,
  className = '',
}: OrganizationBrandingSectionProps) {
  const {
    logoUrl: currentLogoUrl,
    saveLogoAsync,
    removeLogoAsync,
    isSaving,
  } = useOrganizationBranding(organizationId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staged logo for preview before saving
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Confirm delete dialog state
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    setFeedbackMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const error = validateLogoFile(file);
    if (error) {
      setValidationError(error);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setStagedFile(file);
      setStagedPreviewUrl(dataUrl);
    } catch {
      setValidationError('Could not read image file preview.');
    }
  };

  const handleCancelStaged = () => {
    setStagedFile(null);
    setStagedPreviewUrl(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveStaged = async () => {
    if (!stagedFile || isSaving) return;
    setValidationError(null);
    setFeedbackMessage(null);

    try {
      await saveLogoAsync(stagedFile);
      setStagedFile(null);
      setStagedPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFeedbackMessage({
        type: 'success',
        text: 'Company logo uploaded and saved successfully.',
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save logo.',
      });
    }
  };

  const handleConfirmRemove = async () => {
    setIsConfirmRemoveOpen(false);
    setFeedbackMessage(null);

    try {
      await removeLogoAsync();
      setFeedbackMessage({
        type: 'success',
        text: 'Company logo removed successfully.',
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove logo.',
      });
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Company Branding</span>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Configure your company logo. The logo appears to the left of {organizationName} across
          the navbar, organization switcher, and operational headers.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Permission Notice */}
        {!canManage && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            You have read-only access. Only organization owners and administrators with settings management permission can modify branding.
          </div>
        )}

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-2 p-3 text-sm rounded-md border animate-in fade-in slide-in-from-top-1 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Validation Error Alert */}
        {validationError && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 text-sm rounded-md border bg-destructive/10 text-destructive border-destructive/20"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Main Logo Container Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Current Logo Display */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Current Company Logo</h4>
            <div className="h-36 rounded-lg border border-border bg-muted/20 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              {currentLogoUrl ? (
                <div className="h-full w-full flex items-center justify-center">
                  <img
                    src={currentLogoUrl}
                    alt={`${organizationName} company logo`}
                    className="max-h-28 max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60 mx-auto" aria-hidden="true" />
                  <p className="text-xs text-muted-foreground">
                    No custom logo configured. Default icon is currently displayed.
                  </p>
                </div>
              )}
            </div>

            {currentLogoUrl && canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmRemoveOpen(true)}
                disabled={isSaving}
                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                aria-label="Remove current company logo"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Remove Logo</span>
              </Button>
            )}
          </div>

          {/* Upload & Staged Preview */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Upload New Logo</h4>

            {stagedPreviewUrl ? (
              <div className="space-y-3">
                <div className="h-36 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center p-4">
                  <img
                    src={stagedPreviewUrl}
                    alt="New company logo preview"
                    className="max-h-28 max-w-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveStaged}
                    disabled={isSaving}
                    className="gap-1.5 text-xs"
                    aria-label="Save staged company logo"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Saving Logo...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelStaged}
                    disabled={isSaving}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_LOGO_EXTENSIONS.join(',')}
                  onChange={handleFileSelect}
                  disabled={!canManage || isSaving}
                  className="sr-only"
                  id="organization-logo-file-input"
                  aria-label="Select company logo file"
                />

                <label
                  htmlFor="organization-logo-file-input"
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    canManage && !isSaving
                      ? 'bg-card text-foreground border-border hover:bg-accent hover:text-accent-foreground'
                      : 'bg-muted text-muted-foreground border-transparent cursor-not-allowed opacity-60'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>Choose New Logo</span>
                </label>

                <p className="text-xs text-muted-foreground">
                  Supported formats: PNG, JPG, JPEG, SVG, WebP. Maximum file size: 2 MB. Recommended square or landscape orientation with transparent background.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Accessible Remove Confirmation Dialog */}
        {isConfirmRemoveOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            role="alertdialog"
            aria-labelledby="confirm-remove-title"
            aria-describedby="confirm-remove-desc"
          >
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
              <h3 id="confirm-remove-title" className="text-lg font-semibold text-foreground">
                Remove Company Logo
              </h3>
              <p id="confirm-remove-desc" className="text-sm text-muted-foreground">
                Are you sure you want to remove the company logo for {organizationName}? The default building icon will be displayed across the application instead.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfirmRemoveOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmRemove}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Confirm Remove</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
