/**
 * PublicLayout component - Layout wrapper for PulseDesk public website.
 * 
 * Provides consistent layout structure with navbar and footer.
 */

import { Outlet } from 'react-router-dom';
import { PublicNavbar } from '../../features/public/components/PublicNavbar';
import { PublicFooter } from '../../features/public/components/PublicFooter';
import { SkipToContent } from '../../components/accessibility/SkipToContent';

/**
 * PublicLayout component for public pages
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipToContent targetId="main-content" />
      <PublicNavbar />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none" role="main">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
