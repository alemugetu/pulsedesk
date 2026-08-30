/**
 * RealtimeConnectionStatus
 *
 * Detailed realtime status panel for the Operations Command Center. Renders
 * nothing while the feed is live (the header indicator covers that); when the
 * feed is unavailable it surfaces the state, a human-readable explanation,
 * and a retry action that re-attempts the connection for the current
 * organization.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { realtimeService } from '../services/realtimeService';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

function getDescription(state: string, error: string | null): string {
  if (error) {
    return error;
  }
  switch (state) {
    case 'reconnecting':
      return 'The realtime connection was interrupted. Reconnecting with backoff…';
    case 'disconnected':
      return 'Realtime updates are off. Events will appear after a manual refresh.';
    case 'error':
      return 'The realtime connection could not be established.';
    default:
      return '';
  }
}

export function RealtimeConnectionStatus() {
  const { connection } = useRealtimeEvents({ bufferSize: 0 });

  if (connection.state === 'connected' || connection.state === 'connecting') {
    return null;
  }

  const retryable =
    connection.state === 'error' ||
    connection.state === 'reconnecting' ||
    connection.state === 'disconnected';

  return (
    <div
      role="status"
      aria-live="polite"
      data-state={connection.state}
      className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {connection.state === 'error' ? 'Realtime unavailable' : 'Realtime updates paused'}
          </p>
          <p className="text-sm text-text-secondary">
            {getDescription(connection.state, connection.error)}
          </p>
          {retryable && (
            <p className="text-xs text-foreground">
              Reattempt {Math.max(connection.reconnectAttempt, 1)} of 10 completed.
            </p>
          )}
        </div>
      </div>
      {retryable && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => realtimeService.retry()}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}