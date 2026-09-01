/**
 * UserMenu component for PulseDesk application shell.
 * 
 * Provides user account actions including:
 * - Display of authenticated user identity
 * - Logout functionality using existing Phase 13.3 authentication
 * - Profile/account entry placeholder
 * 
 * Integrates with the existing useAuth hook and authentication system.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { User, LogOut, ChevronDown, Settings } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function UserMenu() {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const user = authState.user;
  const isLoading = authState.isLoading;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    navigate('/app/profile');
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    navigate('/app/settings');
  };

  // Get user display name
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.first_name) {
      return user.first_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.first_name) {
      return user.first_name[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Focus first menu item on open
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstEnabledItem = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
      firstEnabledItem?.focus();
    }
  }, [isOpen]);

  // Arrow key navigation inside menu
  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (!menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        id="user-menu-button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User account menu"
        className="flex items-center gap-2 px-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {getInitials()}
          </div>
          <span className="hidden md:inline text-sm font-medium">
            {getDisplayName()}
          </span>
          <ChevronDown className="h-4 w-4 hidden md:block" />
        </div>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-card shadow-lg',
            'animate-in fade-in slide-in-from-top-1',
            'z-50'
          )}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground">{getDisplayName()}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="py-1">
            <button
              onClick={handleProfileClick}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
              )}
              role="menuitem"
            >
              <User className="h-4 w-4" />
              Profile
            </button>

            <button
              onClick={handleSettingsClick}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
              )}
              role="menuitem"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>

          <div className="border-t border-border py-1">
            <button
              onClick={handleLogout}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive',
                'hover:bg-accent hover:text-destructive',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
              )}
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
