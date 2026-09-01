/**
 * ThemeSwitcher component - Theme control for PulseDesk.
 * 
 * Provides visible theme management with Light/Dark/System options.
 * Uses lucide-react icons for clear visual indicators.
 */

import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';
import { cn } from '../../utils/cn';

/**
 * Icon lookup object for theme modes - defined outside component to avoid
 * creating new component references on each render
 */
const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

/**
 * ThemeSwitcher component for theme management
 */
export function ThemeSwitcher() {
  const { theme, setLight, setDark, setSystem } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const themeOptions = [
    { 
      value: 'light' as const, 
      label: 'Light', 
      icon: Sun,
      action: setLight 
    },
    { 
      value: 'dark' as const, 
      label: 'Dark', 
      icon: Moon,
      action: setDark 
    },
    { 
      value: 'system' as const, 
      label: 'System', 
      icon: Monitor,
      action: setSystem 
    },
  ];

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus active option on open
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const activeItem =
        menuRef.current.querySelector<HTMLElement>('[aria-current="true"]') ||
        menuRef.current.querySelector<HTMLElement>('[role="menuitem"]');
      activeItem?.focus();
    }
  }, [isOpen]);

  // Arrow key navigation inside menu
  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (!menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
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

  const CurrentIcon = THEME_ICONS[theme.mode] || Monitor;

  return (
    <div className="relative">
      {/* Theme Toggle Button */}
      <button
        ref={buttonRef}
        id="theme-menu-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative inline-flex items-center justify-center',
          'p-2 rounded-lg',
          'text-foreground hover:bg-accent',
          'transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Current theme: ${theme.mode}. Toggle theme menu`}
      >
        <CurrentIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Theme Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              buttonRef.current?.focus();
            }}
            aria-hidden="true"
          />

          {/* Dropdown Menu */}
          <div
            ref={menuRef}
            onKeyDown={handleMenuKeyDown}
            className={cn(
              'absolute right-0 top-full z-50 mt-2',
              'min-w-[140px]',
              'bg-background border border-border rounded-lg shadow-lg',
              'py-1',
              'focus:outline-none'
            )}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="theme-menu-button"
          >
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme.mode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    option.action();
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={cn(
                    'relative flex w-full items-center gap-3 px-3 py-2 text-sm',
                    'transition-colors',
                    'focus:outline-none focus:bg-accent focus:ring-2 focus:ring-ring focus:ring-inset',
                    isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                  role="menuitem"
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{option.label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
