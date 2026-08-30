/**
 * Tests for RealtimeIndicator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    subscribeEvents: vi.fn(() => () => {}),
    retry: vi.fn(),
  };
});

vi.mock('../services/realtimeService', () => ({
  realtimeService: {
    subscribeState: () => realtimeMocks.subscribeState(),
    subscribeEvents: () => realtimeMocks.subscribeEvents(),
    getSnapshot: () => realtimeMocks.getSnapshot(),
    retry: () => realtimeMocks.retry(),
  },
}));

import { RealtimeIndicator } from '../components/RealtimeIndicator';

function snapshotWith(state: RealtimeConnectionInfo['state']): RealtimeConnectionInfo {
  return {
    state,
    error: state === 'error' ? 'Realtime connection rejected.' : null,
    reconnectAttempt: 1,
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
  realtimeMocks.subscribeState.mockClear();
});

describe('RealtimeIndicator', () => {
  it('shows Live when connected', () => {
    realtimeMocks.setSnapshot(snapshotWith('connected'));
    render(<RealtimeIndicator />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows Connecting while the handshake is in progress', () => {
    realtimeMocks.setSnapshot(snapshotWith('connecting'));
    render(<RealtimeIndicator />);
    expect(screen.getByText(/Connecting/)).toBeInTheDocument();
  });

  it('shows Reconnecting during backoff retry', () => {
    realtimeMocks.setSnapshot(snapshotWith('reconnecting'));
    render(<RealtimeIndicator />);
    expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
  });

  it('shows Offline when intentionally disconnected', () => {
    render(<RealtimeIndicator />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows Connection error in the error state with an explanatory tooltip', () => {
    realtimeMocks.setSnapshot(snapshotWith('error'));
    render(<RealtimeIndicator />);
    expect(screen.getByText('Connection error')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'title',
      expect.stringContaining('Realtime connection rejected')
    );
  });

  it('is announced politely and marked as a live region', () => {
    render(<RealtimeIndicator />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('data-state', 'disconnected');
  });
});