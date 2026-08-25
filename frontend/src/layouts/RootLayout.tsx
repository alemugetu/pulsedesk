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

import { type ReactNode } from 'react';

interface RootLayoutProps {
  children?: ReactNode;
}

/**
 * Root layout component - minimal structural foundation.
 * Phase 13.1: Basic container with full viewport height.
 */
export function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
