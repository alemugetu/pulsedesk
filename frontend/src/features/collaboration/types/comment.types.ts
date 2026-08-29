import type { PaginatedResponse } from '../../../types/common';

export interface CommentAuthor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

export interface MentionedUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Comment {
  id: string;
  incident: string;
  author: CommentAuthor;
  body: string;
  is_internal: boolean;
  mentioned_users: MentionedUser[];
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export type CommentListResponse = PaginatedResponse<Comment>;

export interface CreateCommentRequest {
  body: string;
  is_internal?: boolean;
}

export interface UpdateCommentRequest {
  body?: string;
  is_internal?: boolean;
}
