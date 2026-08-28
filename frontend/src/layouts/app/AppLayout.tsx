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
import { cn } from '../../utils/cn';

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Application Navbar */}
      <AppNavbar
        onMobileMenuToggle={handleMobileMenuToggle}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Main Layout Container */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Sidebar */}
        <MobileSidebar
          isOpen={isMobileMenuOpen}
          onClose={handleMobileMenuClose}
        />

        {/* Main Content Area */}
        <main
          className={cn(
            'flex-1 min-h-[calc(100vh-4rem)]', // Subtract navbar height
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
