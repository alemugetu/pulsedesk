/**
 * Root Layout component for PulseDesk.
 * 
 * Provides the structural root for future routing/layout work.
 * Phase 13.1: Minimal implementation without sidebar, navbar, footer, or specific page layouts.
 * 
 * Future phases will add:
 * - Public layout (for landing page)
 * - Auth layout (for login/register)
 * - App layout (with sidebar/navbar for protected routes)
 */

import { Outlet } from 'react-router-dom';

/**
 * Root layout component - minimal structural foundation.
 * Phase 13.1: Basic container with full viewport height.
 * Phase 13.2: Fixed to use Outlet for React Router nested route rendering.
 */
export function RootLayout() {
  return (
    <div className="h-full w-full bg-background text-foreground">
      <Outlet />
    </div>
  );
}
