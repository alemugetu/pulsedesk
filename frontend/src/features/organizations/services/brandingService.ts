/**
 * Organization Branding Service for PulseDesk.
 *
 * Manages organization-scoped company logos with tenant isolation.
 * Validates file constraints (MIME type, size <= 2MB) and persists
 * branding with zero cross-tenant leakage.
 */

import {
  type OrganizationBranding,
  MAX_LOGO_FILE_SIZE_BYTES,
  ACCEPTED_LOGO_MIME_TYPES,
  ACCEPTED_LOGO_EXTENSIONS,
} from '../types/branding.types';

function getStorageKey(organizationId: string): string {
  return `pulsedesk_org_branding_${organizationId}`;
}

/**
 * Validates a logo file for format and size constraints.
 */
export function validateLogoFile(file: File): string | null {
  if (!file) {
    return 'Please select a logo file.';
  }

  // File size validation (<= 2MB)
  if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
    return 'The selected image is too large. Maximum size allowed is 2 MB.';
  }

  // MIME type and extension validation
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
  const isTypeValid =
    ACCEPTED_LOGO_MIME_TYPES.includes(file.type.toLowerCase()) ||
    ACCEPTED_LOGO_EXTENSIONS.includes(fileExt);

  if (!isTypeValid) {
    return `Unsupported file format. Please upload a valid PNG, JPG, JPEG, SVG, or WebP image.`;
  }

  return null;
}

/**
 * Reads a File and resolves as a base64 Data URL.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to image URL.'));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Error reading image file.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Retrieves the branding for a specific organization.
 */
export function getOrganizationBranding(
  organizationId: string
): OrganizationBranding {
  if (!organizationId) {
    return { organizationId: '', logoUrl: null, updatedAt: '' };
  }

  try {
    const stored = localStorage.getItem(getStorageKey(organizationId));
    if (stored) {
      const parsed = JSON.parse(stored) as OrganizationBranding;
      if (parsed && parsed.organizationId === organizationId) {
        return parsed;
      }
    }
  } catch {
    // Fallback gracefully on storage read errors
  }

  return {
    organizationId,
    logoUrl: null,
    updatedAt: '',
  };
}

/**
 * Saves and persists a new logo for the organization.
 */
export async function saveOrganizationLogo(
  organizationId: string,
  file: File
): Promise<OrganizationBranding> {
  const error = validateLogoFile(file);
  if (error) {
    throw new Error(error);
  }

  const dataUrl = await readFileAsDataUrl(file);

  const branding: OrganizationBranding = {
    organizationId,
    logoUrl: dataUrl,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(getStorageKey(organizationId), JSON.stringify(branding));
  } catch {
    throw new Error('Failed to store company logo in browser storage.');
  }

  return branding;
}

/**
 * Removes the configured logo for the organization.
 */
export async function removeOrganizationLogo(
  organizationId: string
): Promise<void> {
  if (!organizationId) return;

  try {
    localStorage.removeItem(getStorageKey(organizationId));
  } catch {
    // Ignore storage removal errors
  }
}
