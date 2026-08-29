import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttachmentList } from '../components/AttachmentList';
import type { Attachment } from '../types/attachment.types';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'current-user', email: 'me@example.com' } }),
}));

vi.mock('../hooks/useDeleteAttachment', () => ({
  useDeleteAttachment: () => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    mutate: vi.fn(),
    reset: vi.fn(),
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    data: undefined,
  }),
}));

const mockAttachments: Attachment[] = [
  {
    id: 'att-1',
    incident: 'inc-1',
    uploader: {
      id: 'u1',
      email: 'alice@example.com',
      first_name: 'Alice',
      last_name: 'Smith',
    },
    original_filename: 'screenshot.png',
    content_type: 'image/png',
    file_size: 20480,
    download_url: '/attachments/att-1/download',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'att-2',
    incident: 'inc-1',
    uploader: {
      id: 'u2',
      email: 'bob@example.com',
      first_name: 'Bob',
      last_name: 'Jones',
    },
    original_filename: 'report.pdf',
    content_type: 'application/pdf',
    file_size: 1024 * 256,
    download_url: '/attachments/att-2/download',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ctxValue = {
    organizations: [{ id: 'org-1', name: 'Acme', slug: 'acme', created_at: '2024-01-01T00:00:00Z' }],
    currentOrganization: { id: 'org-1', name: 'Acme', slug: 'acme', created_at: '2024-01-01T00:00:00Z' },
    isLoadingOrganizations: false,
    isLoadingCurrent: false,
    organizationsError: null,
    currentError: null,
    hasOrganizations: true,
    selectOrganization: vi.fn(),
    clearCurrentOrganization: vi.fn(),
    createOrganization: vi.fn(),
    refreshOrganizations: vi.fn(),
    hasPermission: (p: string) => ['incident.view', 'incident.manage'].includes(p),
    getCurrentRole: () => 'member',
  } as const;
  return render(
    <QueryClientProvider client={qc}>
      <OrganizationContext.Provider value={ctxValue as never}>
        {ui}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
}

describe('AttachmentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty list without errors', () => {
    wrap(<AttachmentList attachments={[]} incidentId="inc-1" />);
    expect(screen.queryByTestId('attachment-item')).not.toBeInTheDocument();
  });

  it('renders each attachment with filename, download, and delete buttons', () => {
    wrap(<AttachmentList attachments={mockAttachments} incidentId="inc-1" />);
    expect(screen.getAllByTestId('attachment-item')).toHaveLength(2);
    expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getAllByTestId('attachment-download-button')).toHaveLength(2);
    expect(screen.getAllByTestId('attachment-delete-button')).toHaveLength(2);
  });

  it('displays humanized file sizes', () => {
    wrap(<AttachmentList attachments={mockAttachments} incidentId="inc-1" />);
    expect(screen.getByText('20 KB')).toBeInTheDocument();
    expect(screen.getByText('256 KB')).toBeInTheDocument();
  });
});
