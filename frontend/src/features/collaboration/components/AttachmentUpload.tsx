import { useRef, useState, ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import {
  Paperclip,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useUploadAttachment } from '../hooks/useUploadAttachment';
import {
  validateFile,
  formatFileSize,
} from '../utils/attachmentUtils';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../types/attachment.types';
import { normalizeApiError } from '../../../api/errors';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';

interface AttachmentUploadProps {
  incidentId: string | null;
  onAfterUpload?: () => void;
}

export function AttachmentUpload({
  incidentId,
  onAfterUpload,
}: AttachmentUploadProps) {
  const { hasPermission } = useOrganizationContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMutation = useUploadAttachment(incidentId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canUpload = hasPermission('incident.view');

  const reset = () => {
    setSelectedFile(null);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (file: File | null) => {
    setLocalError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const result = validateFile(file);
    if (!result.ok) {
      setLocalError(result.error || 'Invalid file.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    handleFileSelect(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const result = validateFile(selectedFile);
    if (!result.ok) {
      setLocalError(result.error || 'Invalid file.');
      return;
    }
    setLocalError(null);
    try {
      await uploadMutation.mutateAsync(selectedFile);
      reset();
      onAfterUpload?.();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setLocalError(normalized.message);
    }
  };

  const handleCancel = () => {
    reset();
  };

  const apiError = uploadMutation.error
    ? normalizeApiError(uploadMutation.error).message
    : null;

  if (!canUpload) {
    return (
      <div className="text-sm text-muted-foreground" data-testid="attachment-upload-no-permission">
        You do not have permission to upload attachments.
      </div>
    );
  }

  const acceptList = ALLOWED_ATTACHMENT_EXTENSIONS.join(',');

  return (
    <div className="space-y-3" data-testid="attachment-upload">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptList}
        onChange={handleChange}
        data-testid="attachment-file-input"
        aria-label="Attachment file input"
      />

      {!selectedFile ? (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={handleKey}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`w-full min-h-[96px] rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer px-3 py-4 text-center transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-surface-400 hover:border-primary-500/60 hover:bg-surface-300'
          }`}
          data-testid="attachment-dropzone"
        >
          <Upload
            size={20}
            className="text-text-tertiary"
            aria-hidden="true"
          />
          <div className="text-sm text-text-secondary">
            Click or drag a file here to upload
          </div>
          <div className="text-xs text-text-tertiary">
            Allowed: {ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')} · Max{' '}
            {formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-md border border-surface-400 bg-surface-300/60 flex flex-wrap items-center gap-3">
          <Paperclip size={16} className="text-primary-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div
              className="text-sm text-text-primary truncate"
              title={selectedFile.name}
              data-testid="attachment-selected-name"
            >
              {selectedFile.name}
            </div>
            <div className="text-xs text-text-tertiary">
              {formatFileSize(selectedFile.size)}
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            data-testid="attachment-upload-button"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={uploadMutation.isPending}
            aria-label="Cancel attachment"
          >
            <X size={14} aria-hidden="true" />
          </Button>
        </div>
      )}

      {(localError || apiError) ? (
        <div
          className="flex items-start gap-2 p-3 rounded-md bg-error-500/10 border border-error-500/30 text-sm text-error-500"
          role="alert"
          data-testid="attachment-upload-error"
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{localError || apiError}</span>
        </div>
      ) : null}
    </div>
  );
}
