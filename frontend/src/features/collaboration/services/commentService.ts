import { api } from '../../../api/client';
import type {
  Comment,
  CommentListResponse,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '../types/comment.types';

function getBaseUrl(organizationId: string, incidentId: string): string {
  return `/api/v1/organizations/${organizationId}/incidents/${incidentId}/comments`;
}

export async function getComments(
  organizationId: string,
  incidentId: string,
  params?: {
    page?: number;
  }
): Promise<CommentListResponse> {
  const url = `${getBaseUrl(organizationId, incidentId)}/`;
  return api.get<CommentListResponse>(url, { params });
}

export async function getComment(
  organizationId: string,
  incidentId: string,
  commentId: string
): Promise<Comment> {
  const url = `${getBaseUrl(organizationId, incidentId)}/${commentId}/`;
  return api.get<Comment>(url);
}

export async function createComment(
  organizationId: string,
  incidentId: string,
  data: CreateCommentRequest
): Promise<Comment> {
  const url = `${getBaseUrl(organizationId, incidentId)}/`;
  return api.post<Comment>(url, data);
}

export async function updateComment(
  organizationId: string,
  incidentId: string,
  commentId: string,
  data: UpdateCommentRequest
): Promise<Comment> {
  const url = `${getBaseUrl(organizationId, incidentId)}/${commentId}/`;
  return api.patch<Comment>(url, data);
}

export async function deleteComment(
  organizationId: string,
  incidentId: string,
  commentId: string
): Promise<void> {
  const url = `${getBaseUrl(organizationId, incidentId)}/${commentId}/`;
  return api.delete<void>(url);
}
