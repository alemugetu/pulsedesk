import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getComments,
  getComment,
  createComment,
  updateComment,
  deleteComment,
} from '../services/commentService';
import { api } from '../../../api/client';
import type { Comment } from '../types/comment.types';

vi.mock('../../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const ORG_ID = 'org-123';
const INCIDENT_ID = 'inc-456';
const COMMENT_ID = 'cmt-789';

const mockComment: Comment = {
  id: COMMENT_ID,
  incident: INCIDENT_ID,
  author: {
    id: 'u1',
    email: 'author@example.com',
    first_name: 'Alice',
    last_name: 'Smith',
    full_name: 'Alice Smith',
  },
  body: 'Test comment body',
  is_internal: false,
  mentioned_users: [],
  is_owner: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('commentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getComments', () => {
    it('fetches paginated comments for incident with org/incident scoped URL', async () => {
      const mockResponse = {
        count: 1,
        next: null,
        previous: null,
        results: [mockComment],
      };
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await getComments(ORG_ID, INCIDENT_ID, { page: 2 });

      expect(api.get).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments/`,
        { params: { page: 2 } }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getComment', () => {
    it('fetches a single comment by id', async () => {
      vi.mocked(api.get).mockResolvedValue(mockComment);

      const result = await getComment(ORG_ID, INCIDENT_ID, COMMENT_ID);

      expect(api.get).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments/${COMMENT_ID}/`
      );
      expect(result).toEqual(mockComment);
    });
  });

  describe('createComment', () => {
    it('POSTs a new comment with body and is_internal flag', async () => {
      vi.mocked(api.post).mockResolvedValue(mockComment);
      const payload = { body: 'New comment', is_internal: true };

      const result = await createComment(ORG_ID, INCIDENT_ID, payload);

      expect(api.post).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments/`,
        payload
      );
      expect(result).toEqual(mockComment);
    });
  });

  describe('updateComment', () => {
    it('PATCHes the comment body via organization-scoped URL', async () => {
      vi.mocked(api.patch).mockResolvedValue({
        ...mockComment,
        body: 'Updated body',
      });

      const result = await updateComment(ORG_ID, INCIDENT_ID, COMMENT_ID, {
        body: 'Updated body',
      });

      expect(api.patch).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments/${COMMENT_ID}/`,
        { body: 'Updated body' }
      );
      expect(result.body).toBe('Updated body');
    });
  });

  describe('deleteComment', () => {
    it('DELETEs the comment via organization-scoped URL', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined);

      await deleteComment(ORG_ID, INCIDENT_ID, COMMENT_ID);

      expect(api.delete).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/comments/${COMMENT_ID}/`
      );
    });
  });
});
