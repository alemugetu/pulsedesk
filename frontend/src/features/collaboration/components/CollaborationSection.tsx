import { CommentSection } from './CommentSection';
import { AttachmentSection } from './AttachmentSection';

interface CollaborationSectionProps {
  incidentId: string | null;
}

export function CollaborationSection({
  incidentId,
}: CollaborationSectionProps) {
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="collaboration-section"
    >
      <CommentSection incidentId={incidentId} />
      <AttachmentSection incidentId={incidentId} />
    </div>
  );
}
