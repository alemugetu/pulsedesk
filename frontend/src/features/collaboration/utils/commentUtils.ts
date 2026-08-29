import type { CommentAuthor } from '../types/comment.types';

export function formatCommentTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString;
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) {
      return 'Just now';
    }
    if (diffMin < 60) {
      return `${diffMin}m ago`;
    }
    if (diffHr < 24) {
      return `${diffHr}h ago`;
    }
    if (diffDay < 7) {
      return `${diffDay}d ago`;
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function getAuthorDisplayName(author: CommentAuthor): string {
  const fullName = author.full_name?.trim();
  if (fullName) {
    return fullName;
  }
  const parts = [author.first_name, author.last_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }
  return author.email;
}

export function getAuthorInitials(author: CommentAuthor): string {
  const display = getAuthorDisplayName(author);
  if (display === author.email) {
    return author.email.charAt(0).toUpperCase();
  }
  const parts = display.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

export function validateCommentBody(body: unknown): string | null {
  if (typeof body !== 'string') {
    return 'Comment body is required.';
  }
  const clean = body.trim();
  if (clean.length === 0) {
    return 'Comment body cannot be empty.';
  }
  return null;
}
