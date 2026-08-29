import type { PaginatedResponse } from '../../../types/common';

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.txt',
  '.log',
] as const;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/octet-stream',
] as const;

export const BLOCKED_ATTACHMENT_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.dll',
  '.py',
  '.js',
  '.html',
  '.htm',
  '.svg',
  '.php',
  '.rb',
  '.pl',
  '.vbs',
  '.jar',
  '.msi',
  '.com',
  '.scr',
  '.pif',
  '.hta',
] as const;

export interface AttachmentUploader {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Attachment {
  id: string;
  incident: string;
  uploader: AttachmentUploader;
  original_filename: string;
  content_type: string;
  file_size: number;
  download_url: string;
  created_at: string;
  updated_at: string;
}

export type AttachmentListResponse = PaginatedResponse<Attachment>;
