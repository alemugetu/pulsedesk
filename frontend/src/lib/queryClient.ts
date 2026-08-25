/**
 * TanStack Query configuration for PulseDesk.
 * 
 * Provides a centralized QueryClient with sensible defaults for:
 * - Stale time
 * - Retry behavior
 * - Refetch behavior
 * - Error handling
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create and configure the QueryClient with production-friendly defaults.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        
        // Data stays in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        
        // Retry failed requests 3 times
        retry: 3,
        
        // Retry with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch on window focus (can be disabled per query)
        refetchOnWindowFocus: false,
        
        // Refetch on reconnect
        refetchOnReconnect: true,
        
        // Don't refetch on mount by default (avoids unnecessary requests)
        refetchOnMount: false,
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
        
        // Retry with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  });
}

// Create singleton instance
export const queryClient = createQueryClient();
