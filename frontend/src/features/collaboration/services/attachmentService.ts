import { api, apiClient } from '../../../api/client';
import type {
  Attachment,
  AttachmentListResponse,
} from '../types/attachment.types';

function getBaseUrl(organizationId: string, incidentId: string): string {
  return `/api/v1/organizations/${organizationId}/incidents/${incidentId}/attachments`;
}

export async function getAttachments(
  organizationId: string,
  incidentId: string,
  params?: {
    page?: number;
  }
): Promise<AttachmentListResponse> {
  const url = `${getBaseUrl(organizationId, incidentId)}/`;
  return api.get<AttachmentListResponse>(url, { params });
}

export async function uploadAttachment(
  organizationId: string,
  incidentId: string,
  file: File
): Promise<Attachment> {
  const url = `${getBaseUrl(organizationId, incidentId)}/`;
  const formData = new FormData();
  formData.append('file', file, file.name);
  return api.post<Attachment>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function downloadAttachment(
  organizationId: string,
  incidentId: string,
  attachmentId: string,
  originalFilename: string
): Promise<void> {
  const url = `${getBaseUrl(organizationId, incidentId)}/${attachmentId}/download/`;
  const response = await apiClient.get(url, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data as BlobPart], {
    type: (response.data as Blob).type || 'application/octet-stream',
  });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    const safeName = (originalFilename || 'download').replace(/["\\]/g, '');
    link.setAttribute('download', safeName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}

export async function deleteAttachment(
  organizationId: string,
  incidentId: string,
  attachmentId: string
): Promise<void> {
  const url = `${getBaseUrl(organizationId, incidentId)}/${attachmentId}/`;
  return api.delete<void>(url);
}
