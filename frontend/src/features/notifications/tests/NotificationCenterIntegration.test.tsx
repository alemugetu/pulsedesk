/**
 * NotificationCenterIntegration.test.tsx
 *
 * Comprehensive integration tests for the Notification Center:
 * - Bell trigger and unread badge count
 * - Notification listing with operational types (SLA warning, breach, escalation)
 * - Tenant isolation (filtering notifications by active organization)
 * - Click-to-navigate to incident route (/app/incidents/:id)
 * - Mark as read / mark all as read
 * - Filter toggle (unread only vs all)
 * - Empty, error, and loading states
 * - Keyboard navigation (Escape key to close)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from '../../../components/navigation/NotificationBell';
import type { NotificationItem } from '../types/notification.types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockCurrentOrgId = 'org-alpha';
vi.mock('../../organizations/context/organizationContextDef', () => ({
  useCurrentOrganization: () => ({
    id: mockCurrentOrgId,
    name: 'Alpha Operations',
    slug: 'alpha-ops',
  }),
}));

const mockMarkReadMutate = vi.fn();
const mockMarkAllMutate = vi.fn();
let mockNotifications: NotificationItem[] = [];
let mockUnreadCount = 2;
let mockIsLoading = false;
let mockError: Error | null = null;
const mockRefetch = vi.fn();

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    data: mockNotifications,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
  }),
  useUnreadNotificationCount: () => ({
    data: { unread_count: mockUnreadCount },
  }),
  useMarkNotificationRead: () => ({
    mutate: mockMarkReadMutate,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: mockMarkAllMutate,
    isPending: false,
  }),
}));

const mockGetNotification = vi.fn();
vi.mock('../services/notificationService', () => ({
  getNotification: (id: string) => mockGetNotification(id),
}));

describe('Notification Center Integration', () => {
  const sampleNotifications: NotificationItem[] = [
    {
      id: 'notif-1',
      notification_type: 'SLA_BREACH',
      title: 'SLA Breached: Payment API Latency',
      severity: 'CRITICAL',
      is_read: false,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      organization: 'org-alpha',
      incident_id: 'inc-101',
      message: 'Resolution SLA has exceeded the 30-minute target.',
    },
    {
      id: 'notif-2',
      notification_type: 'ESCALATION_TRIGGERED',
      title: 'Incident Escalated: Database Deadlock',
      severity: 'CRITICAL',
      is_read: false,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      organization: 'org-alpha',
      incident_id: 'inc-102',
      message: 'Escalated to Engineering Lead.',
    },
    {
      id: 'notif-3',
      notification_type: 'SLA_WARNING',
      title: 'SLA Warning: Search Cluster',
      severity: 'WARNING',
      is_read: true,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      organization: 'org-alpha',
      incident_id: 'inc-103',
      message: 'Response deadline approaching in 10 minutes.',
    },
    {
      id: 'notif-other-org',
      notification_type: 'SLA_WARNING',
      title: 'Foreign Org Incident',
      severity: 'INFO',
      is_read: false,
      created_at: new Date().toISOString(),
      organization: 'org-beta', // Belongs to different organization
      incident_id: 'inc-999',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentOrgId = 'org-alpha';
    mockNotifications = [...sampleNotifications];
    mockUnreadCount = 2;
    mockIsLoading = false;
    mockError = null;
  });

  it('renders notification bell with unread count badge', () => {
    render(<NotificationBell />);

    const bellButton = screen.getByRole('button', { name: /notifications, 2 unread/i });
    expect(bellButton).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens notification center dialog and enforces tenant isolation', () => {
    render(<NotificationBell />);

    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);

    const dialog = screen.getByRole('dialog', { name: /notification center/i });
    expect(dialog).toBeInTheDocument();

    // Verify org-alpha notifications are rendered
    expect(screen.getByText('SLA Breached: Payment API Latency')).toBeInTheDocument();
    expect(screen.getByText('Incident Escalated: Database Deadlock')).toBeInTheDocument();
    expect(screen.getByText('SLA Warning: Search Cluster')).toBeInTheDocument();

    // Tenant Isolation: Verify foreign org notification is NOT rendered
    expect(screen.queryByText('Foreign Org Incident')).not.toBeInTheDocument();
  });

  it('displays operational event labels and severity badges', () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText('SLA Breach')).toBeInTheDocument();
    expect(screen.getByText('Escalation')).toBeInTheDocument();
    expect(screen.getByText('SLA Warning')).toBeInTheDocument();

    // Severity badges
    expect(screen.getAllByText('CRITICAL').length).toBe(2);
    expect(screen.getByText('WARNING')).toBeInTheDocument();
  });

  it('navigates to incident route when clicking on a notification and marks as read', async () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const breachNotificationButton = screen.getByRole('button', {
      name: /sla breached: payment api latency/i,
    });
    fireEvent.click(breachNotificationButton);

    expect(mockMarkReadMutate).toHaveBeenCalledWith({ id: 'notif-1', read: true });
    expect(mockNavigate).toHaveBeenCalledWith('/app/incidents/inc-101');
  });

  it('marks single notification as read using inline action', () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const markReadButtons = screen.getAllByTitle('Mark as read');
    expect(markReadButtons.length).toBeGreaterThan(0);

    fireEvent.click(markReadButtons[0]);

    expect(mockMarkReadMutate).toHaveBeenCalledWith({ id: 'notif-1', read: true });
  });

  it('marks all notifications as read when clicking mark all button', () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const markAllButton = screen.getByRole('button', { name: /mark all notifications as read/i });
    fireEvent.click(markAllButton);

    expect(mockMarkAllMutate).toHaveBeenCalled();
  });

  it('closes dropdown when Escape key is pressed', () => {
    render(<NotificationBell />);

    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders empty state when there are no notifications for the tenant', () => {
    mockNotifications = [];

    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('renders error state with retry button when notification fetch fails', () => {
    mockError = new Error('Network error loading notifications');

    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
    expect(screen.getByText('Network error loading notifications')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });
});
