/**
 * TypeScript types for Organization Branding.
 */

export interface OrganizationBranding {
  organizationId: string;
  logoUrl: string | null;
  updatedAt: string;
}

export const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const ACCEPTED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
];

export const ACCEPTED_LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

export interface BrandingValidationError {
  field: 'file';
  message: string;
}
