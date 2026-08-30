/**
 * RealtimeConnectionBridge
 *
 * App-shell mount point for the realtime subsystem. Renders nothing; it exists
 * so useOperationsRealtime (connection driver + query cache routing) lives at
 * the application shell level rather than inside one page, keeping incident
 * list/detail/comment/attachment/SLA surfaces fresh wherever the user is.
 */

import { useOperationsRealtime } from '../hooks/useOperationsRealtime';

export function RealtimeConnectionBridge() {
  void useOperationsRealtime();
  return null;
}