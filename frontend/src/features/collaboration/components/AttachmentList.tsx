import type { Attachment } from '../types/attachment.types';
import { AttachmentItem } from './AttachmentItem';

interface AttachmentListProps {
  attachments: Attachment[];
  incidentId: string | null;
}

export function AttachmentList({ attachments, incidentId }: AttachmentListProps) {
  return (
    <div
      className="flex flex-col gap-3"
      data-testid="attachment-list"
      aria-label="Incident attachments"
    >
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          incidentId={incidentId}
        />
      ))}
    </div>
  );
}
