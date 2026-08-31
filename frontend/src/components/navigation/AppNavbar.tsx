/**
 * AppNavbar component for PulseDesk application shell.
 * 
 * The application navbar is specifically for the authenticated application shell.
 * It contains appropriate authenticated-app controls including:
 * - PulseDesk branding
 * - Mobile menu trigger
 * - Organization switcher placement
 * - User menu
 * - Theme switcher
 * - Responsive behavior
 * 
 * This is distinct from the public Navbar used on landing pages.
 */

import { Menu } from 'lucide-react';
import { Button } from '../ui/Button';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { cn } from '../../utils/cn';

interface AppNavbarProps {
  /** Callback to toggle mobile sidebar */
  onMobileMenuToggle: () => void;
  /** Whether mobile sidebar is currently open */
  isMobileMenuOpen?: boolean;
  /** Callback to collapse or expand the desktop sidebar */
  onSidebarToggle: () => void;
  /** Whether the desktop sidebar is collapsed */
  isSidebarCollapsed: boolean;
}

export function AppNavbar({
  onMobileMenuToggle,
  isMobileMenuOpen = false,
  onSidebarToggle,
  isSidebarCollapsed,
}: AppNavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full shrink-0 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60'
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side: navigation triggers and branding */}
        <div className="flex items-center gap-4">
          {/* Mobile menu trigger wrapped in div to guarantee md:hidden responsiveness */}
          <div className="block md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMobileMenuToggle}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Desktop sidebar toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSidebarToggle}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="desktop-sidebar"
            className="hidden md:inline-flex"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Branding */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">P</span>
            </div>
            <span className="hidden sm:block text-lg font-semibold text-foreground">
              PulseDesk
            </span>
          </div>
        </div>

        {/* Right side: Organization switcher, notifications, theme, and user menu */}
        <div className="flex items-center gap-2">
          {/* Organization switcher */}
          <div className="hidden md:block">
            <OrganizationSwitcher />
          </div>

          {/* Notifications */}
          <NotificationBell />

          {/* Theme switcher */}
          <ThemeSwitcher />

          {/* User menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
