/**
 * PublicNavbar component - Navigation bar for PulseDesk public website.
 * 
 * Provides responsive navigation with mobile menu support.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ThemeSwitcher } from '../../../components/theme/ThemeSwitcher';
import { NAV_ROUTES, AUTH_ROUTES, SITE_NAME } from '../constants';
import { cn } from '../../../utils/cn';

/**
 * PublicNavbar component for public website navigation
 */
export function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: NAV_ROUTES.HOME.label, path: NAV_ROUTES.HOME.path },
    { label: NAV_ROUTES.FEATURES.label, path: NAV_ROUTES.FEATURES.path },
    { label: NAV_ROUTES.ABOUT.label, path: NAV_ROUTES.ABOUT.path },
    { label: NAV_ROUTES.CONTACT.label, path: NAV_ROUTES.CONTACT.path },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" role="navigation" aria-label="Main navigation">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              to={NAV_ROUTES.HOME.path}
              className="flex items-center gap-2 text-xl font-bold text-foreground transition-colors hover:text-primary focus:outline-none rounded-md"
              aria-label={`${SITE_NAME} home`}
            >
              <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
              <span>{SITE_NAME}</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative text-sm font-medium transition-colors hover:text-primary focus:outline-none px-2 py-1',
                  isActive(item.path)
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                {item.label}
                {isActive(item.path) && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-primary" aria-hidden="true" />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons + Theme Switcher */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <ThemeSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link to={AUTH_ROUTES.LOGIN.path}>
                {AUTH_ROUTES.LOGIN.label}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to={AUTH_ROUTES.REGISTER.path}>
                {AUTH_ROUTES.REGISTER.label}
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border" role="menu">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'block rounded-md px-3 py-2 text-base font-medium transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  isActive(item.path)
                    ? 'bg-accent text-primary'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => setMobileMenuOpen(false)}
                role="menuitem"
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border px-4 py-3 space-y-2">
            <Button asChild variant="ghost" className="w-full justify-start" onClick={() => setMobileMenuOpen(false)}>
              <Link to={AUTH_ROUTES.LOGIN.path}>
                {AUTH_ROUTES.LOGIN.label}
              </Link>
            </Button>
            <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
              <Link to={AUTH_ROUTES.REGISTER.path}>
                {AUTH_ROUTES.REGISTER.label}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
