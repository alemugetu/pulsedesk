import { useState } from 'react';
import {
  FileText,
  Image,
  Download,
  Trash2,
  Clock,
  File,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { Attachment } from '../types/attachment.types';
import { formatFileSize, getContentTypeLabel } from '../utils/attachmentUtils';
import { formatCommentTimestamp, getAuthorDisplayName, getAuthorInitials } from '../utils/commentUtils';
import { downloadAttachment } from '../services/attachmentService';
import { useDeleteAttachment } from '../hooks/useDeleteAttachment';
import { normalizeApiError } from '../../../api/errors';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';
import { useAuth } from '../../auth/hooks/useAuth';

interface AttachmentItemProps {
  attachment: Attachment;
  incidentId: string | null;
}

function getContentIcon(contentType: string) {
  const normalized = (contentType || '').split(';')[0].trim().toLowerCase();
  if (normalized.startsWith('image/')) {
    return <Image size={20} aria-hidden="true" />;
  }
  if (normalized === 'application/pdf') {
    return <FileText size={20} aria-hidden="true" />;
  }
  return <File size={20} aria-hidden="true" />;
}

export function AttachmentItem({ attachment, incidentId }: AttachmentItemProps) {
  const { currentOrganization, hasPermission } = useOrganizationContext();
  const { user: authUser } = useAuth();
  const deleteMutation = useDeleteAttachment(incidentId);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const isUploader = authUser && attachment.uploader.id === authUser.id;
  const canManage = hasPermission('incident.manage');
  const canDelete = isUploader || canManage;

  const uploaderName = getAuthorDisplayName(attachment.uploader as unknown as Parameters<typeof getAuthorDisplayName>[0]);
  const uploaderInitials = getAuthorInitials(attachment.uploader as unknown as Parameters<typeof getAuthorInitials>[0]);
  const timestamp = formatCommentTimestamp(attachment.created_at);

  const handleDownload = async () => {
    if (!currentOrganization?.id) return;
    setDownloadError(null);
    try {
      await downloadAttachment(
        currentOrganization.id,
        attachment.incident,
        attachment.id,
        attachment.original_filename
      );
    } catch (err) {
      const normalized = normalizeApiError(err);
      setDownloadError(normalized.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete attachment "${attachment.original_filename}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(attachment.id);
    } catch {
      /* error is on mutation; global fallback */
    }
  };

  const deleteError = deleteMutation.error
    ? normalizeApiError(deleteMutation.error).message
    : null;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md border border-surface-400 hover:bg-surface-300 transition-colors"
      data-testid="attachment-item"
      id={`attachment-${attachment.id}`}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-surface-400 flex items-center justify-center text-primary-400">
        {getContentIcon(attachment.content_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className="text-sm font-medium text-text-primary truncate"
              title={attachment.original_filename}
              data-testid="attachment-filename"
            >
              {attachment.original_filename}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary mt-0.5">
              <span>{getContentTypeLabel(attachment.content_type)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatFileSize(attachment.file_size)}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                <time dateTime={attachment.created_at}>{timestamp}</time>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-text-tertiary">
              <span className="w-5 h-5 rounded-full bg-surface-400 inline-flex items-center justify-center text-[10px] font-semibold text-white/70">
                {uploaderInitials}
              </span>
              <span className="truncate">{uploaderName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              aria-label={`Download ${attachment.original_filename}`}
              disabled={deleteMutation.isPending}
              data-testid="attachment-download-button"
            >
              <Download size={14} aria-hidden="true" />
              Download
            </Button>
            {canDelete ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                aria-label={`Delete ${attachment.original_filename}`}
                disabled={deleteMutation.isPending}
                data-testid="attachment-delete-button"
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>

        {(downloadError || deleteError) ? (
          <div className="mt-2 text-xs text-error-500" role="alert" data-testid="attachment-error">
            {downloadError || deleteError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
