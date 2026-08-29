import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
} from '../services/attachmentService';
import { api, apiClient } from '../../../api/client';
import type { Attachment } from '../types/attachment.types';

vi.mock('../../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  apiClient: {
    get: vi.fn(),
  },
}));

const ORG_ID = 'org-123';
const INCIDENT_ID = 'inc-456';
const ATTACHMENT_ID = 'att-789';

const mockAttachment: Attachment = {
  id: ATTACHMENT_ID,
  incident: INCIDENT_ID,
  uploader: {
    id: 'u1',
    email: 'uploader@example.com',
    first_name: 'Bob',
    last_name: 'Jones',
  },
  original_filename: 'screenshot.png',
  content_type: 'image/png',
  file_size: 1024 * 50,
  download_url: `http://localhost/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/attachments/${ATTACHMENT_ID}/download/`,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('attachmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAttachments', () => {
    it('fetches paginated attachments for incident with org/incident scoped URL', async () => {
      const mockResponse = {
        count: 1,
        next: null,
        previous: null,
        results: [mockAttachment],
      };
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await getAttachments(ORG_ID, INCIDENT_ID, { page: 1 });

      expect(api.get).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/attachments/`,
        { params: { page: 1 } }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('uploadAttachment', () => {
    it('POSTs a multipart FormData with file field', async () => {
      const file = new File(['content'], 'report.pdf', {
        type: 'application/pdf',
      });
      vi.mocked(api.post).mockResolvedValue(mockAttachment);

      const result = await uploadAttachment(ORG_ID, INCIDENT_ID, file);

      expect(api.post).toHaveBeenCalledTimes(1);
      const [url, formData, opts] = vi.mocked(api.post).mock.calls[0] as [
        string,
        FormData,
        { headers?: { 'Content-Type'?: string } }
      ];
      expect(url).toBe(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/attachments/`
      );
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.has('file')).toBe(true);
      expect(opts?.headers?.['Content-Type']).toBe('multipart/form-data');
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('deleteAttachment', () => {
    it('DELETEs the attachment via org/incident scoped URL', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined);

      await deleteAttachment(ORG_ID, INCIDENT_ID, ATTACHMENT_ID);

      expect(api.delete).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/attachments/${ATTACHMENT_ID}/`
      );
    });
  });

  describe('downloadAttachment', () => {
    const mockBlob = new Blob(['file-content'], { type: 'application/pdf' });

    it('downloads a blob via apiClient with responseType blob and triggers download', async () => {
      vi.useFakeTimers();
      const { downloadAttachment } = await import('../services/attachmentService');
      vi.mocked(apiClient.get).mockResolvedValue({
        data: mockBlob,
      } as never);
      const createObjectUrlSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock-url');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValueOnce({
          href: '',
          setAttribute: vi.fn(),
          style: {},
          click: vi.fn(),
        } as unknown as HTMLElement);
      const appendChild = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);
      const removeChild = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);

      await downloadAttachment(ORG_ID, INCIDENT_ID, ATTACHMENT_ID, 'report.pdf');
      await vi.advanceTimersByTimeAsync(1000);

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORG_ID}/incidents/${INCIDENT_ID}/attachments/${ATTACHMENT_ID}/download/`,
        { responseType: 'blob' }
      );
      expect(createObjectUrlSpy).toHaveBeenCalled();
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChild).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalled();
      expect(revokeSpy).toHaveBeenCalled();

      createObjectUrlSpy.mockRestore();
      revokeSpy.mockRestore();
      createElementSpy.mockRestore();
      appendChild.mockRestore();
      removeChild.mockRestore();
      vi.useRealTimers();
    });
  });
});
