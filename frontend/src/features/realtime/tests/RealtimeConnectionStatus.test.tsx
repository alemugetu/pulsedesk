/**
 * Tests for RealtimeConnectionStatus.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RealtimeConnectionInfo } from '../types/realtime.types';

const realtimeMocks = vi.hoisted(() => {
  const holder: { snapshot: RealtimeConnectionInfo } = {
    snapshot: {
      state: 'disconnected',
      error: null,
      reconnectAttempt: 0,
      organizationId: null,
      lastConnectedAt: null,
      lastEventAt: null,
      lastEvent: null,
      isConnected: false,
      isConnecting: false,
    },
  };
  return {
    getSnapshot: () => holder.snapshot,
    setSnapshot: (next: RealtimeConnectionInfo) => {
      holder.snapshot = next;
    },
    subscribeState: vi.fn(() => () => {}),
    retry: vi.fn(),
  };
});

vi.mock('../services/realtimeService', () => ({
  realtimeService: {
    subscribeState: () => realtimeMocks.subscribeState(),
    subscribeEvents: vi.fn(() => () => {}),
    getSnapshot: () => realtimeMocks.getSnapshot(),
    retry: () => realtimeMocks.retry(),
  },
}));

import { RealtimeConnectionStatus } from '../components/RealtimeConnectionStatus';

function snapshotWith(
  state: RealtimeConnectionInfo['state'],
  reconnectAttempt = 1
): RealtimeConnectionInfo {
  return {
    state,
    error: state === 'error' ? 'Realtime connection rejected.' : null,
    reconnectAttempt,
    organizationId: 'org-1',
    lastConnectedAt: state === 'connected' ? '2024-01-15T10:00:00Z' : null,
    lastEventAt: null,
    lastEvent: null,
    isConnected: state === 'connected',
    isConnecting: state === 'connecting' || state === 'reconnecting',
  };
}

beforeEach(() => {
  realtimeMocks.retry.mockReset();
  realtimeMocks.setSnapshot(snapshotWith('disconnected'));
});

describe('RealtimeConnectionStatus', () => {
  it('renders nothing while the feed is connected', () => {
    realtimeMocks.setSnapshot(snapshotWith('connected'));
    render(<RealtimeConnectionStatus />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders nothing while a connecting handshake is in flight', () => {
    realtimeMocks.setSnapshot(snapshotWith('connecting', 0));
    render(<RealtimeConnectionStatus />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a paused banner with retry when disconnected', () => {
    render(<RealtimeConnectionStatus />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'disconnected');
    expect(screen.getByText('Realtime updates paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('surfaces the backend rejection message in the error state', () => {
    realtimeMocks.setSnapshot(snapshotWith('error'));
    render(<RealtimeConnectionStatus />);
    expect(screen.getByText('Realtime unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Realtime connection rejected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('reconnects on retry click', async () => {
    const user = userEvent.setup();
    realtimeMocks.setSnapshot(snapshotWith('error'));
    render(<RealtimeConnectionStatus />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(realtimeMocks.retry).toHaveBeenCalledTimes(1);
  });

  it('is announced politely', () => {
    render(<RealtimeConnectionStatus />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});