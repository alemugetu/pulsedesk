/**
 * ThemeSwitcher component - Theme control for PulseDesk.
 * 
 * Provides visible theme management with Light/Dark/System options.
 * Uses lucide-react icons for clear visual indicators.
 */

import { useState } from 'react';
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

  const CurrentIcon = THEME_ICONS[theme.mode] || Monitor;

  return (
    <div className="relative">
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative inline-flex items-center justify-center',
          'p-2 rounded-lg',
          'text-foreground hover:bg-accent',
          'transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          'aria-expanded:aria-expanded'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Toggle theme menu"
      >
        <CurrentIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Theme Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown Menu */}
          <div
            className={cn(
              'absolute right-0 top-full z-50 mt-2',
              'min-w-[140px]',
              'bg-background border border-border rounded-lg shadow-lg',
              'py-1',
              'focus:outline-none'
            )}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="theme-menu"
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
                  }}
                  className={cn(
                    'relative flex w-full items-center gap-3 px-3 py-2 text-sm',
                    'transition-colors',
                    'focus:outline-none focus:bg-accent',
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
