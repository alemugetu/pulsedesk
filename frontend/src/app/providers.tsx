/**
 * Application Providers for PulseDesk.
 * 
 * Centralizes all global providers in the correct order:
 * React Query -> Auth Provider -> Organization Provider -> Theme Provider -> Router Provider
 * 
 * This ensures proper provider hierarchy and initialization order.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../features/auth/hooks/AuthContext';
import { OrganizationProvider } from '../features/organizations/context/OrganizationContext';
import { queryClient } from '../lib/queryClient';
import { router } from '../routes';
import { App } from './App';

/**
 * Root providers component that wraps the application with all necessary providers.
 * Phase 13.1: Router is integrated at the provider level for routing foundation.
 * Phase 13.3: AuthProvider added for authentication state management.
 * Phase 13.5: OrganizationProvider added for multi-tenant organization state management.
 */
export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <ThemeProvider defaultTheme="system">
            <App>
              <RouterProvider router={router} />
            </App>
          </ThemeProvider>
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
