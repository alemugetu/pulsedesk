/**
 * RealtimeIndicator
 *
 * A subtle connection-lifecycle pill shown in the Operations Command Center
 * header. Text-based (not color-only) and announced politely on change.
 */

import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import { cn } from '../../../utils/cn';
import type { RealtimeConnectionState } from '../types/realtime.types';

interface StatePresentation {
  label: string;
  dotClass: string;
  busy: boolean;
}

const STATE_PRESENTATION: Record<RealtimeConnectionState, StatePresentation> = {
  connected: { label: 'Live', dotClass: 'bg-green-500', busy: false },
  connecting: { label: 'Connecting…', dotClass: 'bg-yellow-500', busy: true },
  reconnecting: { label: 'Reconnecting…', dotClass: 'bg-yellow-500', busy: true },
  disconnected: { label: 'Offline', dotClass: 'bg-slate-500', busy: false },
  error: { label: 'Connection error', dotClass: 'bg-red-500', busy: false },
};

export function RealtimeIndicator() {
  const { connection } = useRealtimeEvents({ bufferSize: 0 });
  const presentation = STATE_PRESENTATION[connection.state];

  const title =
    connection.isConnected || connection.state === 'connecting'
      ? undefined
      : connection.error ?? 'Realtime connection is not active.';

  return (
    <span
      role="status"
      aria-live="polite"
      data-state={connection.state}
      title={title}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary"
    >
      <span
        className={cn('h-2 w-2 rounded-full', presentation.dotClass, presentation.busy && 'animate-pulse')}
        aria-hidden="true"
      />
      <span className="sr-only">Realtime: </span>
      {presentation.label}
    </span>
  );
}