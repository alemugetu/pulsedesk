import { useState, FormEvent, ChangeEvent } from 'react';
import { Send, Lock, Unlock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { validateCommentBody } from '../utils/commentUtils';
import { getFieldError, normalizeApiError } from '../../../api/errors';
import { useCreateComment } from '../hooks/useCreateComment';

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
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(initialInternal);
  const [localError, setLocalError] = useState<string | null>(null);

  const createMutation = useCreateComment(incidentId);
  const isDisabled = createMutation.isPending;

  const reset = () => {
    setBody('');
    setLocalError(null);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    if (localError) {
      const v = validateCommentBody(e.target.value);
      if (!v) setLocalError(null);
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
      reset();
      onAfterSubmit?.();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setLocalError(getFieldError(normalized, 'body') || normalized.message);
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
        className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 min-h-[96px] resize-y placeholder:text-muted-foreground"
        placeholder="Add a comment..."
        value={body}
        onChange={handleChange}
        disabled={isDisabled}
        aria-label="Comment body"
        aria-invalid={!!(localError || apiError)}
        data-testid="comment-body-input"
        maxLength={5000}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
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
            disabled={isDisabled || !body.trim()}
            data-testid="comment-submit-button"
          >
            <Send size={14} aria-hidden="true" />
            {isDisabled ? 'Posting...' : 'Post comment'}
          </Button>
        </div>
      </div>
    </form>
  );
}
