/**
 * Realtime barrel exports for the PulseDesk realtime operations integration.
 */

export { RealtimeIndicator } from './components/RealtimeIndicator';
export { RealtimeConnectionStatus } from './components/RealtimeConnectionStatus';
export { useRealtimeConnection } from './hooks/useRealtimeConnection';
export { useRealtimeEvents } from './hooks/useRealtimeEvents';
export { useOperationsRealtime } from './hooks/useOperationsRealtime';
export { realtimeService } from './services/realtimeService';
export {
  WebSocketClient,
  createOperationsWebSocket,
} from './services/websocketClient';
export type {
  RealtimeSocket,
  RealtimeSocketFactory,
  RealtimeReconnectPolicy,
  WebSocketClientOptions,
} from './services/websocketClient';
export {
  SUPPORTED_EVENT_TYPES,
  REALTIME_EVENT_VERSION,
  buildOperationsWebSocketUrl,
  eventBelongsToOrganization,
  getEventFingerprint,
  getIncidentIdFromEventData,
  getRealtimeEventLabel,
  isAuthenticationRejection,
  isRealtimeEventEnvelope,
  isRealtimeEventType,
} from './utils/realtimeUtils';
export { getRealtimeInvalidationTargets } from './utils/realtimeRouting';
export type {
  RealtimeConnectionInfo,
  RealtimeConnectionState,
  RealtimeConnectTarget,
  RealtimeEvent,
  RealtimeEventEnvelope,
  RealtimeEventType,
} from './types/realtime.types';