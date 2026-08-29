import type { Comment } from '../types/comment.types';
import { CommentItem } from './CommentItem';

interface CommentListProps {
  comments: Comment[];
  onRefetch?: () => void;
}

export function CommentList({ comments, onRefetch }: CommentListProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Incident comments"
      className="flex flex-col gap-3"
      data-testid="comment-list"
    >
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onRefetch={onRefetch}
        />
      ))}
    </div>
  );
}
