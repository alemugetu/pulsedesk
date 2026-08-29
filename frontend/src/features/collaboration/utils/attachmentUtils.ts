import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  BLOCKED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_ATTACHMENT_MIME_TYPES,
} from '../types/attachment.types';

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  const precision = size >= 100 || i === 0 ? 0 : 1;
  const formatted = size.toFixed(precision).replace(/\.0$/, '');
  return `${formatted} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return '';
  return filename.slice(idx).toLowerCase();
}

export function isAllowedExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  if (!ext) return false;
  if (BLOCKED_ATTACHMENT_EXTENSIONS.includes(ext as typeof BLOCKED_ATTACHMENT_EXTENSIONS[number])) {
    return false;
  }
  return ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext as typeof ALLOWED_ATTACHMENT_EXTENSIONS[number]);
}

export function isAllowedMimeType(mimeType: string): boolean {
  const normalized = (mimeType || '').split(';')[0].trim().toLowerCase();
  return ALLOWED_ATTACHMENT_MIME_TYPES.includes(normalized as typeof ALLOWED_ATTACHMENT_MIME_TYPES[number]);
}

export function isAllowedFileSize(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_ATTACHMENT_SIZE_BYTES;
}

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  if (!file) {
    return { ok: false, error: 'No file selected.' };
  }
  if (file.size === 0) {
    return { ok: false, error: 'Empty files are not allowed.' };
  }
  if (!isAllowedFileSize(file.size)) {
    return {
      ok: false,
      error: `File size ${formatFileSize(file.size)} exceeds the maximum allowed ${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}.`,
    };
  }
  const ext = getFileExtension(file.name);
  if (BLOCKED_ATTACHMENT_EXTENSIONS.includes(ext as typeof BLOCKED_ATTACHMENT_EXTENSIONS[number])) {
    return { ok: false, error: `File type '${ext}' is not allowed.` };
  }
  if (!isAllowedExtension(file.name)) {
    return {
      ok: false,
      error: `File extension '${ext || '(none)'}' is not permitted. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}.`,
    };
  }
  if (!isAllowedMimeType(file.type)) {
    return {
      ok: false,
      error: `Content type '${file.type || '(unknown)'}' is not permitted.`,
    };
  }
  const expectedMimes: Record<string, readonly string[]> = {
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.webp': ['image/webp'],
    '.pdf': ['application/pdf'],
    '.txt': ['text/plain'],
    '.log': ['text/plain', 'application/octet-stream'],
  };
  const normalizedMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const allowed = expectedMimes[ext];
  if (allowed && normalizedMime && !allowed.includes(normalizedMime)) {
    return {
      ok: false,
      error: `Content type '${normalizedMime}' is not consistent with extension '${ext}'.`,
    };
  }
  return { ok: true };
}

export function getContentTypeLabel(contentType: string): string {
  const normalized = (contentType || '').split(';')[0].trim().toLowerCase();
  if (normalized.startsWith('image/')) return 'Image';
  if (normalized === 'application/pdf') return 'PDF';
  if (normalized === 'text/plain' || normalized === 'application/octet-stream') return 'Text / Log';
  return 'File';
}
