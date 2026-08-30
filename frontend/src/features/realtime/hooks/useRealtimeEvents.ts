/**
 * useRealtimeEvents
 *
 * Subscriber hook. Consumes the realtimeService snapshot and (optionally) the
 * validated event stream. Buffers the most recent events so callers can show
 * "last event" style feedback without extra request work.
 *
 * bufferSize: 0 disables the event subscription entirely and returns only the
 * connection snapshot — the right choice for components that only render
 * connection status.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { realtimeService } from '../services/realtimeService';
import type { RealtimeConnectionInfo, RealtimeEvent } from '../types/realtime.types';

export interface UseRealtimeEventsOptions {
  /** Subscribe to the event stream and buffer events. Default true. */
  enabled?: boolean;
  /**
   * Maximum number of buffered events. 0 disables event buffering (and the
   * event subscription); the minimum retained buffer size is 1.
   */
  bufferSize?: number;
}

export interface UseRealtimeEventsResult {
  connection: RealtimeConnectionInfo;
  events: RealtimeEvent<unknown>[];
  lastEvent: RealtimeEvent<unknown> | null;
  clearEvents: () => void;
}

const DEFAULT_BUFFER_SIZE = 50;

export function useRealtimeEvents(options?: UseRealtimeEventsOptions): UseRealtimeEventsResult {
  const enabled = options?.enabled ?? true;
  const bufferSize = options?.bufferSize ?? DEFAULT_BUFFER_SIZE;
  const trackEvents = enabled && bufferSize > 0;

  const [events, setEvents] = useState<RealtimeEvent<unknown>[]>([]);

  useEffect(() => {
    if (!trackEvents) {
      return;
    }
    return realtimeService.subscribeEvents((event) => {
      setEvents((previous) => {
        const kept = previous.slice(-(bufferSize - 1));
        return [...kept, event];
      });
    });
  }, [trackEvents, bufferSize]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const connection = useSyncExternalStore(
    (listener) => realtimeService.subscribeState(listener),
    () => realtimeService.getSnapshot()
  );

  return useMemo(() => {
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    return { connection, events, lastEvent, clearEvents };
  }, [connection, events, clearEvents]);
}