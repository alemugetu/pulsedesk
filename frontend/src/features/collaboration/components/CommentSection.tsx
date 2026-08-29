import { MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loading } from '../../../components/ui/Loading';
import { useComments } from '../hooks/useComments';
import { CommentList } from './CommentList';
import { CommentForm } from './CommentForm';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';

interface CommentSectionProps {
  incidentId: string | null;
}

export function CommentSection({ incidentId }: CommentSectionProps) {
  const { hasPermission } = useOrganizationContext();
  const { comments, isLoading, isError, error, refetch, invalidateComments } =
    useComments(incidentId);

  const canView = hasPermission('incident.view');
  const canComment = hasPermission('incident.view');

  if (!canView) {
    return (
      <Card data-testid="comment-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare size={16} aria-hidden="true" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text-tertiary">
            You do not have permission to view comments.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="comment-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare size={16} aria-hidden="true" />
          Comments
          <span className="text-xs text-text-tertiary font-normal">
            {comments.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loading data-testid="comments-loading" />
        ) : isError ? (
          <ErrorState
            title="Failed to load comments"
            message={error?.message || 'An unexpected error occurred.'}
            onRetry={() => refetch()}
            data-testid="comments-error"
          />
        ) : comments.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={32} aria-hidden="true" />}
            title="No comments yet"
            description="Be the first to add a comment on this incident."
            data-testid="comments-empty"
          />
        ) : (
          <CommentList
            comments={comments}
            onRefetch={() => {
              invalidateComments();
              refetch();
            }}
          />
        )}

        {canComment ? (
          <div className="border-t border-surface-400 pt-4 mt-4">
            <CommentForm
              incidentId={incidentId}
              onAfterSubmit={() => {
                invalidateComments();
                refetch();
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
