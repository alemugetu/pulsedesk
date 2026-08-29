import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationContext } from '../../organizations/context/organizationContextDef';
import { AttachmentUpload } from '../components/AttachmentUpload';
import * as hooks from '../hooks/useUploadAttachment';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../types/attachment.types';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ authState: { user: { id: 'u1', email: 'me@example.com' } } }),
}));

function wrap(ui: React.ReactElement, perms: readonly string[] = ['incident.view']) {
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
    hasPermission: (p: string) => perms.includes(p),
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

describe('AttachmentUpload', () => {
  let mutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync = vi.fn().mockResolvedValue({ id: 'att-1' });
    vi.spyOn(hooks, 'useUploadAttachment').mockReturnValue({
      isPending: false,
      mutateAsync,
      mutate: vi.fn(),
      error: null,
      isError: false,
      isSuccess: false,
      isIdle: true,
      reset: vi.fn(),
      status: 'idle',
      data: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
      variables: undefined,
      context: undefined,
    } as never);
  });

  it('renders dropzone with file input when no file selected', () => {
    wrap(<AttachmentUpload incidentId="inc-1" />);
    expect(screen.getByTestId('attachment-dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-file-input')).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-upload-button')).not.toBeInTheDocument();
  });

  it('shows no-permission state when user lacks incident.view', () => {
    wrap(<AttachmentUpload incidentId="inc-1" />, [] as const);
    expect(screen.getByTestId('attachment-upload-no-permission')).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-dropzone')).not.toBeInTheDocument();
  });

  it('rejects oversized files before calling backend', async () => {
    wrap(<AttachmentUpload incidentId="inc-1" />);
    const bigFile = new File(
      [new Uint8Array(MAX_ATTACHMENT_SIZE_BYTES + 1).fill(0)],
      'big.png',
      { type: 'image/png' }
    );
    const input = screen.getByTestId('attachment-file-input');
    Object.defineProperty(input, 'files', {
      value: [bigFile],
      writable: false,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-upload-error')).toBeInTheDocument();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('rejects blocked/unsupported extensions before calling backend', async () => {
    wrap(<AttachmentUpload incidentId="inc-1" />);
    const evil = new File(['payload'], 'evil.exe', { type: 'application/octet-stream' });
    const input = screen.getByTestId('attachment-file-input');
    Object.defineProperty(input, 'files', { value: [evil], writable: false });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-upload-error')).toBeInTheDocument();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('selects a valid file, shows metadata, and uploads on submit', async () => {
    wrap(<AttachmentUpload incidentId="inc-1" />);
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const input = screen.getByTestId('attachment-file-input');
    Object.defineProperty(input, 'files', { value: [file], writable: false });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-selected-name')).toHaveTextContent('notes.txt');
    });
    fireEvent.click(screen.getByTestId('attachment-upload-button'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(file);
  });
});
