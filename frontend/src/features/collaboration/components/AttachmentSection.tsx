import { Paperclip } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loading } from '../../../components/ui/Loading';
import { useAttachments } from '../hooks/useAttachments';
import { AttachmentList } from './AttachmentList';
import { AttachmentUpload } from './AttachmentUpload';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';

interface AttachmentSectionProps {
  incidentId: string | null;
}

export function AttachmentSection({ incidentId }: AttachmentSectionProps) {
  const { hasPermission } = useOrganizationContext();
  const { attachments, isLoading, isError, error, refetch, invalidateAttachments } =
    useAttachments(incidentId);

  const canView = hasPermission('incident.view');
  const canUpload = hasPermission('incident.view');

  if (!canView) {
    return (
      <Card data-testid="attachment-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip size={16} aria-hidden="true" />
            Attachments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text-tertiary">
            You do not have permission to view attachments.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="attachment-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip size={16} aria-hidden="true" />
          Attachments
          <span className="text-xs text-text-tertiary font-normal">
            {attachments.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loading data-testid="attachments-loading" />
        ) : isError ? (
          <ErrorState
            title="Failed to load attachments"
            message={error?.message || 'An unexpected error occurred.'}
            onRetry={() => refetch()}
            data-testid="attachments-error"
          />
        ) : attachments.length === 0 ? (
          <EmptyState
            icon={<Paperclip size={32} aria-hidden="true" />}
            title="No attachments yet"
            description="Upload a file to share evidence, logs, or supporting documents."
            data-testid="attachments-empty"
          />
        ) : (
          <AttachmentList
            attachments={attachments}
            incidentId={incidentId}
          />
        )}

        {canUpload ? (
          <div className="border-t border-surface-400 pt-4 mt-4">
            <AttachmentUpload
              incidentId={incidentId}
              onAfterUpload={() => {
                invalidateAttachments();
                refetch();
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
