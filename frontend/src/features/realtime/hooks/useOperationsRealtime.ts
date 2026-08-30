/**
 * useOperationsRealtime
 *
 * App-level realtime orchestrator: drives the operations connection and
 * routes validated events into the existing TanStack Query cache. It is
 * mounted once (RealtimeConnectionBridge, in AppLayout) so incident lists,
 * incident detail, comments, attachments, SLA and escalation surfaces all
 * refresh when the backend publishes an authoritative event.
 *
 * Routing prefers invalidation + refetch over cache mutation because the
 * event payloads are projection snapshots, not full cache shapes. Each event
 * is processed exactly once (fingerprint guard); cross-organization events
 * are filtered by the service and again by the routing helper.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getRealtimeInvalidationTargets } from '../utils/realtimeRouting';
import { getEventFingerprint } from '../utils/realtimeUtils';
import { useRealtimeConnection } from './useRealtimeConnection';
import { useRealtimeEvents } from './useRealtimeEvents';
import type { RealtimeConnectionInfo } from '../types/realtime.types';

export interface UseOperationsRealtimeOptions {
  enabled?: boolean;
}

export interface UseOperationsRealtimeResult {
  connection: RealtimeConnectionInfo;
}

export function useOperationsRealtime(options?: UseOperationsRealtimeOptions): UseOperationsRealtimeResult {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const organization = useCurrentOrganization();

  useRealtimeConnection({ enabled });
  const { connection, events } = useRealtimeEvents({ enabled, bufferSize: 50 });

  const processedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (events.length === 0) {
      return;
    }
    const latestEvent = events[events.length - 1];
    const fingerprint = getEventFingerprint(latestEvent);
    if (fingerprint === processedFingerprintRef.current) {
      return;
    }
    processedFingerprintRef.current = fingerprint;

    const organizationId = organization?.id ?? null;
    const targets = getRealtimeInvalidationTargets(latestEvent, organizationId);
    for (const queryKey of targets) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [events, organization?.id, queryClient]);

  return { connection };
}