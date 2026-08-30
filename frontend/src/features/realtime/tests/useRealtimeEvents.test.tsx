/**
 * Tests for useRealtimeEvents (the subscriber hook).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const realtimeMocks = vi.hoisted(() => {
  const eventListeners: Array<(event: unknown) => void> = [];
  const snapshot = {
    state: 'connected' as const,
    error: null,
    reconnectAttempt: 0,
    organizationId: 'org-1',
    lastConnectedAt: '2024-01-15T10:00:00Z',
    lastEventAt: null,
    lastEvent: null,
    isConnected: true,
    isConnecting: false,
  };
  return {
    eventListeners,
    getSnapshot: () => snapshot,
    subscribeEvents: vi.fn((listener: (event: unknown) => void) => {
      eventListeners.push(listener);
      return () => {
        const index = eventListeners.indexOf(listener);
        if (index >= 0) {
          eventListeners.splice(index, 1);
        }
      };
    }),
    subscribeState: vi.fn(() => () => {}),
  };
});

vi.mock('../services/realtimeService', () => ({
  realtimeService: realtimeMocks,
}));

import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

const eventA = {
  event: 'incident.created',
  version: '1.0',
  organization_id: 'org-1',
  timestamp: '2024-01-15T10:00:00Z',
  data: { id: 'inc-1', title: 'A' },
};
const eventB = {
  event: 'comment.created',
  version: '1.0',
  organization_id: 'org-1',
  timestamp: '2024-01-15T10:01:00Z',
  data: { id: 'c1', incident_id: 'inc-1' },
};

beforeEach(() => {
  realtimeMocks.eventListeners.length = 0;
  realtimeMocks.subscribeEvents.mockClear();
});

describe('useRealtimeEvents', () => {
  it('exposes the live connection snapshot', () => {
    const { result } = renderHook(() => useRealtimeEvents());

    expect(result.current.connection.state).toBe('connected');
    expect(result.current.connection.isConnected).toBe(true);
  });

  it('buffers accepted events and exposes the most recent', () => {
    const { result } = renderHook(() => useRealtimeEvents({ bufferSize: 5 }));

    act(() => {
      realtimeMocks.eventListeners[0]?.(eventA);
      realtimeMocks.eventListeners[0]?.(eventB);
    });

    expect(result.current.events).toEqual([eventA, eventB]);
    expect(result.current.lastEvent).toBe(eventB);
  });

  it('caps the buffer at the configured size', () => {
    const { result } = renderHook(() => useRealtimeEvents({ bufferSize: 2 }));

    act(() => {
      realtimeMocks.eventListeners[0]?.(eventA);
      realtimeMocks.eventListeners[0]?.(eventB);
      realtimeMocks.eventListeners[0]?.({
        ...eventA,
        event: 'incident.updated',
        timestamp: '2024-01-15T10:02:00Z',
      });
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.lastEvent?.event).toBe('incident.updated');
  });

  it('skips the event subscription when bufferSize is 0 (state only)', () => {
    const { result } = renderHook(() => useRealtimeEvents({ bufferSize: 0 }));

    expect(realtimeMocks.subscribeEvents).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
    expect(result.current.lastEvent).toBeNull();
    expect(result.current.connection.state).toBe('connected');
  });

  it('skips the event subscription when disabled', () => {
    renderHook(() => useRealtimeEvents({ enabled: false }));
    expect(realtimeMocks.subscribeEvents).not.toHaveBeenCalled();
  });

  it('clearEvents empties the buffer', () => {
    const { result } = renderHook(() => useRealtimeEvents({ bufferSize: 5 }));

    act(() => {
      realtimeMocks.eventListeners[0]?.(eventA);
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.clearEvents();
    });
    expect(result.current.events).toEqual([]);
    expect(result.current.lastEvent).toBeNull();
  });

  it('unsubscribes from the event stream on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeEvents({ bufferSize: 5 }));

    expect(realtimeMocks.eventListeners).toHaveLength(1);
    unmount();
    expect(realtimeMocks.eventListeners).toHaveLength(0);
  });
});