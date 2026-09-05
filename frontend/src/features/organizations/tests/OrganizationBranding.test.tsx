/**
 * OrganizationBranding.test.tsx
 *
 * Comprehensive tests for Organization Branding & Company Logo:
 * - Logo file validation (types & 2MB size limit)
 * - OrganizationBrand component (logo to the left of name, fallback icon, error fallback, a11y)
 * - OrganizationBrandingSection settings (preview, save, remove with dialog, RBAC permission gating)
 * - Tenant isolation across organization switches
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationBrand } from '../components/OrganizationBrand';
import { OrganizationBrandingSection } from '../../organization-settings/components/OrganizationBrandingSection';
import { validateLogoFile } from '../services/brandingService';

// Mock localStorage
const mockStorage: Record<string, string> = {};
beforeEach(() => {
  vi.clearAllMocks();
  for (const key in mockStorage) {
    delete mockStorage[key];
  }

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => mockStorage[key] || null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, val: string) => {
    mockStorage[key] = val;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
    delete mockStorage[key];
  });
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Organization Branding & Company Logo Integration', () => {
  describe('validateLogoFile', () => {
    it('approves valid PNG and JPEG files under 2 MB', () => {
      const validPng = new File(['dummy-content'], 'logo.png', { type: 'image/png' });
      expect(validateLogoFile(validPng)).toBeNull();

      const validJpg = new File(['dummy-content'], 'logo.jpg', { type: 'image/jpeg' });
      expect(validateLogoFile(validJpg)).toBeNull();
    });

    it('rejects files larger than 2 MB', () => {
      const largeFile = new File(['x'], 'huge-logo.png', { type: 'image/png' });
      Object.defineProperty(largeFile, 'size', { value: 3 * 1024 * 1024 });

      const error = validateLogoFile(largeFile);
      expect(error).toContain('too large');
      expect(error).toContain('2 MB');
    });

    it('rejects unsupported file formats', () => {
      const exeFile = new File(['x'], 'script.exe', { type: 'application/x-msdownload' });
      const error = validateLogoFile(exeFile);
      expect(error).toContain('Unsupported file format');
    });
  });

  describe('OrganizationBrand Component', () => {
    it('renders company logo to the left of the organization name with accessible alt text', () => {
      const mockLogoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      render(
        <OrganizationBrand
          organizationName="Acme Technologies"
          logoUrl={mockLogoDataUrl}
          showName={true}
        />,
        { wrapper: createWrapper() }
      );

      const logoImg = screen.getByRole('img', { name: /acme technologies logo/i });
      expect(logoImg).toBeInTheDocument();
      expect(logoImg).toHaveAttribute('src', mockLogoDataUrl);

      // Name is present and adjacent
      expect(screen.getByText('Acme Technologies')).toBeInTheDocument();
    });

    it('renders fallback Building2 icon when no logo exists', () => {
      const { container } = render(
        <OrganizationBrand
          organizationName="Acme Technologies"
          logoUrl={null}
          showName={true}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText('Acme Technologies')).toBeInTheDocument();
    });

    it('falls back to Building2 icon if logo image fails to load', () => {
      const { container } = render(
        <OrganizationBrand
          organizationName="Acme Technologies"
          logoUrl="https://invalid-domain.com/broken-logo.png"
          showName={true}
        />,
        { wrapper: createWrapper() }
      );

      const logoImg = screen.getByRole('img', { name: /acme technologies logo/i });
      fireEvent.error(logoImg);

      // After error, image is replaced by fallback SVG
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('OrganizationBrandingSection Settings Component', () => {
    it('renders branding controls for users with settings.manage permission', () => {
      render(
        <OrganizationBrandingSection
          organizationId="org-1"
          organizationName="Acme Corp"
          canManage={true}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Company Branding/i)).toBeInTheDocument();
      expect(screen.getByText(/Choose New Logo/i)).toBeInTheDocument();
      expect(screen.queryByText(/You have read-only access/i)).not.toBeInTheDocument();
    });

    it('renders read-only notice and disables upload for unauthorized users', () => {
      render(
        <OrganizationBrandingSection
          organizationId="org-1"
          organizationName="Acme Corp"
          canManage={false}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/You have read-only access/i)).toBeInTheDocument();
      const input = screen.getByLabelText(/Select company logo file/i);
      expect(input).toBeDisabled();
    });

    it('displays error alert if selected file exceeds 2 MB', async () => {
      render(
        <OrganizationBrandingSection
          organizationId="org-1"
          organizationName="Acme Corp"
          canManage={true}
        />,
        { wrapper: createWrapper() }
      );

      const fileInput = screen.getByLabelText(/Select company logo file/i);
      const largeFile = new File(['content'], 'big.png', { type: 'image/png' });
      Object.defineProperty(largeFile, 'size', { value: 3 * 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/too large/i);
      });
    });

    it('shows preview and saves staged logo', async () => {
      render(
        <OrganizationBrandingSection
          organizationId="org-1"
          organizationName="Acme Corp"
          canManage={true}
        />,
        { wrapper: createWrapper() }
      );

      const fileInput = screen.getByLabelText(/Select company logo file/i);
      const validFile = new File(['valid'], 'company-logo.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save staged company logo/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save staged company logo/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/company logo uploaded and saved successfully/i)
        ).toBeInTheDocument();
      });
    });

    it('opens confirmation dialog before removing logo and executes removal', async () => {
      // Pre-seed storage for org-1
      mockStorage['pulsedesk_org_branding_org-1'] = JSON.stringify({
        organizationId: 'org-1',
        logoUrl: 'data:image/png;base64,sample',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      render(
        <OrganizationBrandingSection
          organizationId="org-1"
          organizationName="Acme Corp"
          canManage={true}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove current company logo/i })).toBeInTheDocument();
      });

      const removeBtn = screen.getByRole('button', { name: /remove current company logo/i });
      fireEvent.click(removeBtn);

      // Dialog opens
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove the company logo/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /confirm remove/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/company logo removed successfully/i)
        ).toBeInTheDocument();
      });
    });

    it('enforces tenant isolation across organizations', async () => {
      mockStorage['pulsedesk_org_branding_org-A'] = JSON.stringify({
        organizationId: 'org-A',
        logoUrl: 'data:image/png;base64,org-A-logo',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const { rerender } = render(
        <OrganizationBrand
          organizationId="org-A"
          organizationName="Alpha Corp"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /alpha corp logo/i })).toBeInTheDocument();
      });

      // Switch to Org B which has no logo
      rerender(
        <OrganizationBrand
          organizationId="org-B"
          organizationName="Beta Corp"
        />
      );

      // Org B must show fallback, not Org A's logo
      await waitFor(() => {
        expect(screen.queryByRole('img', { name: /alpha corp logo/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /beta corp logo/i })).not.toBeInTheDocument();
      });
    });
  });
});
