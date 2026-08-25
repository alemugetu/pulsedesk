/**
 * Application Providers for PulseDesk.
 * 
 * Centralizes all global providers in the correct order:
 * React Query -> Theme Provider -> Router Provider
 * 
 * This ensures proper provider hierarchy and initialization order.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeProvider';
import { queryClient } from '../lib/queryClient';
import { router } from '../routes';
import { App } from './App';

/**
 * Root providers component that wraps the application with all necessary providers.
 * Phase 13.1: Router is integrated at the provider level for routing foundation.
 */
export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <App>
          <RouterProvider router={router} />
        </App>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
