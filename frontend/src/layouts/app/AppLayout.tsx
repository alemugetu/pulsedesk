/**
 * AppLayout component for PulseDesk application shell.
 * 
 * Provides the authenticated application structure with:
 * - Responsive layout (desktop sidebar, mobile navigation)
 * - Persistent application header (AppNavbar)
 * - Main content area with proper scrolling
 * - Accessible layout landmarks
 * - Support for existing theme system
 * - Avoids layout shifting
 * 
 * Layout structure:
 * ┌──────────────────────────────────────────┐
 * │                AppNavbar                  │
 * ├────────────┬─────────────────────────────┤
 * │            │                             │
 * │  Sidebar   │       Main Content          │
 * │            │                             │
 * │            │       Breadcrumbs           │
 * │            │                             │
 * │            │       Page                  │
 * │            │                             │
 * └────────────┴─────────────────────────────┘
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppNavbar } from '../../components/navigation/AppNavbar';
import { Sidebar } from '../../components/navigation/Sidebar';
import { MobileSidebar } from '../../components/navigation/MobileSidebar';
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';
import { RealtimeConnectionBridge } from '../../features/realtime/components/RealtimeConnectionBridge';
import { cn } from '../../utils/cn';

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed((isCollapsed) => !isCollapsed);
  };

return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* App-wide realtime connection driver (renders nothing) */}
      <RealtimeConnectionBridge />

      {/* Application Navbar */}
      <AppNavbar
        onMobileMenuToggle={handleMobileMenuToggle}
        isMobileMenuOpen={isMobileMenuOpen}
        onSidebarToggle={handleSidebarToggle}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Main Layout Container */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar isCollapsed={isSidebarCollapsed} />

        {/* Mobile Sidebar */}
        <MobileSidebar
          isOpen={isMobileMenuOpen}
          onClose={handleMobileMenuClose}
        />

        {/* Main Content Area */}
        <main
          className={cn(
            'min-w-0 min-h-0 flex-1',
            'overflow-y-auto',
            'focus:outline-none'
          )}
          id="main-content"
          tabIndex={-1}
        >
          <div className="container mx-auto px-4 md:px-6 py-6">
            {/* Breadcrumbs */}
            <div className="mb-4">
              <Breadcrumbs />
            </div>

            {/* Page Content */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
