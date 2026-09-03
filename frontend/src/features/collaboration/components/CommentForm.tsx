import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Send, Lock, Unlock, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { validateCommentBody } from '../utils/commentUtils';
import { getFieldError, normalizeApiError } from '../../../api/errors';
import { useCreateComment } from '../hooks/useCreateComment';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';
import { uploadAttachment } from '../services/attachmentService';
import { validateFile, formatFileSize } from '../utils/attachmentUtils';
import { ALLOWED_ATTACHMENT_EXTENSIONS } from '../types/attachment.types';

interface CommentFormProps {
  incidentId: string | null;
  initialInternal?: boolean;
  onAfterSubmit?: () => void;
}

export function CommentForm({
  incidentId,
  initialInternal = false,
  onAfterSubmit,
}: CommentFormProps) {
  const { currentOrganization: organization } = useOrganizationContext();
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(initialInternal);
  const [localError, setLocalError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const createMutation = useCreateComment(incidentId);
  const isDisabled = createMutation.isPending || isUploadingFile;

  const reset = () => {
    setBody('');
    setLocalError(null);
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    if (localError) {
      const v = validateCommentBody(e.target.value);
      if (!v) setLocalError(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validation = validateFile(file);
      if (!validation.ok) {
        setLocalError(validation.error || 'Invalid file.');
        setAttachedFile(null);
        return;
      }
      setAttachedFile(file);
    }
  };

  const handleRemoveAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validateCommentBody(body);
    if (validation) {
      setLocalError(validation);
      return;
    }
    setLocalError(null);
    try {
      await createMutation.mutateAsync({
        body,
        is_internal: isInternal,
      });

      // If a file is attached and we have org and incident, upload it
      if (attachedFile && organization?.id && incidentId) {
        setIsUploadingFile(true);
        try {
          await uploadAttachment(organization.id, incidentId, attachedFile);
        } catch (uploadErr) {
          console.error('Failed to upload comment attachment:', uploadErr);
        }
      }

      reset();
      onAfterSubmit?.();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setLocalError(getFieldError(normalized, 'body') || normalized.message);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const apiError = createMutation.error
    ? normalizeApiError(createMutation.error).message
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
      data-testid="comment-form"
      aria-label="Add comment"
    >
      <textarea
        name="comment-body"
        className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 min-h-[96px] resize-y placeholder:text-gray-500"
        placeholder="Add an operational update or comment..."
        value={body}
        onChange={handleChange}
        disabled={isDisabled}
        aria-label="Comment body"
        aria-invalid={!!(localError || apiError)}
        data-testid="comment-body-input"
        maxLength={5000}
      />

      {/* Staged file badge */}
      {attachedFile && (
        <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border text-xs text-foreground">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-medium truncate">{attachedFile.name}</span>
            <span className="text-muted-foreground">({formatFileSize(attachedFile.size)})</span>
          </div>
          <button
            type="button"
            onClick={handleRemoveAttachedFile}
            className="p-0.5 rounded text-muted-foreground hover:text-destructive"
            aria-label={`Remove file ${attachedFile.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <label
            htmlFor="comment-internal"
            className="flex items-center gap-2 text-text-secondary cursor-pointer select-none"
          >
            <input
              id="comment-internal"
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              disabled={isDisabled}
              className="w-4 h-4 accent-primary-500"
              data-testid="comment-internal-checkbox"
            />
            {isInternal ? (
              <Lock size={14} aria-hidden="true" />
            ) : (
              <Unlock size={14} aria-hidden="true" />
            )}
            Internal note
          </label>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(',')}
            className="hidden"
            aria-hidden="true"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
          >
            <Paperclip className="h-3.5 w-3.5 mr-1" />
            Attach file
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {(localError || apiError) ? (
            <div className="text-sm text-error-500 mr-2" role="alert" data-testid="comment-form-error">
              {localError || apiError}
            </div>
          ) : null}
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={isDisabled}
            data-testid="comment-submit-button"
          >
            {isDisabled ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={14} aria-hidden="true" />
            )}
            {isDisabled ? 'Posting...' : 'Post comment'}
          </Button>
        </div>
      </div>
    </form>
  );
}
