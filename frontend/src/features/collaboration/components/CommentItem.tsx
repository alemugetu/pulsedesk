import { useState } from 'react';
import { Pencil, Trash2, Check, X, Clock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { Comment } from '../types/comment.types';
import {
  formatCommentTimestamp,
  getAuthorDisplayName,
  getAuthorInitials,
  validateCommentBody,
} from '../utils/commentUtils';
import { updateComment, deleteComment } from '../services/commentService';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';
import { getFieldError, normalizeApiError } from '../../../api/errors';

interface CommentItemProps {
  comment: Comment;
  onRefetch?: () => void;
}

export function CommentItem({ comment, onRefetch }: CommentItemProps) {
  const { currentOrganization } = useOrganizationContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const openEdit = () => {
    setEditBody(comment.body);
    setLocalError(null);
    setIsEditing(true);
  };

  const displayName = getAuthorDisplayName(comment.author);
  const initials = getAuthorInitials(comment.author);
  const timestamp = formatCommentTimestamp(comment.created_at);

  const handleSave = async () => {
    const validation = validateCommentBody(editBody);
    if (validation) {
      setLocalError(validation);
      return;
    }
    if (!currentOrganization?.id) return;
    setIsSaving(true);
    setLocalError(null);
    try {
      await updateComment(currentOrganization.id, comment.incident, comment.id, {
        body: editBody,
      });
      setIsEditing(false);
      onRefetch?.();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setLocalError(getFieldError(normalized, 'body') || normalized.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditBody(comment.body);
    setIsEditing(false);
    setLocalError(null);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) {
      return;
    }
    if (!currentOrganization?.id) return;
    setIsDeleting(true);
    try {
      await deleteComment(currentOrganization.id, comment.incident, comment.id);
      onRefetch?.();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setLocalError(normalized.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="flex gap-3 p-3 rounded-md border border-surface-400 hover:bg-surface-300 transition-colors"
      data-testid="comment-item"
      id={`comment-${comment.id}`}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-primary-600"
        aria-hidden="true"
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-text-primary truncate max-w-[50%]" title={displayName}>
            {displayName}
          </span>
          <span className="text-text-tertiary text-xs flex items-center gap-1">
            <Clock size={12} aria-hidden="true" />
            <time dateTime={comment.created_at}>{timestamp}</time>
          </span>
          {comment.is_internal ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Internal
            </span>
          ) : null}
          {comment.is_owner && !isEditing ? (
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit comment ${comment.id}`}
                onClick={openEdit}
                disabled={isSaving || isDeleting}
                data-testid="comment-edit-button"
              >
                <Pencil size={14} aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete comment ${comment.id}`}
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                data-testid="comment-delete-button"
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              className="w-full rounded-md border border-surface-400 bg-surface-200 text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-primary-500 min-h-[80px]"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              aria-label="Edit comment body"
            />
            {localError ? (
              <div className="text-sm text-error-500" role="alert" data-testid="comment-error">
                {localError}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                data-testid="comment-save-button"
              >
                <Check size={14} aria-hidden="true" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X size={14} aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-sm text-text-secondary whitespace-pre-wrap break-words" data-testid="comment-body">
            {comment.body}
          </div>
        )}
      </div>
    </div>
  );
}
