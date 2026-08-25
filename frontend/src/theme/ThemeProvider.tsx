/**
 * Theme Provider for PulseDesk.
 * 
 * Handles:
 * - Light/Dark/System theme modes
 * - Persistent user preference
 * - System preference detection
 * - Reactive system preference changes
 * - Application-wide theme availability
 */

import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeMode, Theme } from './theme';
import { THEME_STORAGE_KEY } from './theme';
import { resolveThemeMode, getInitialThemeMode } from './themeUtils';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
}

/**
 * Theme Provider Component
 */
export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode(defaultTheme));
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>(() => resolveThemeMode(themeMode));

  // Update resolved mode when theme mode changes
  useEffect(() => {
    const newResolvedMode = resolveThemeMode(themeMode);
    
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newResolvedMode);
    
    // Use requestAnimationFrame to defer state update to next frame
    requestAnimationFrame(() => {
      setResolvedMode(newResolvedMode);
    });
  }, [themeMode]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      const newResolvedMode = event.matches ? 'dark' : 'light';
      
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newResolvedMode);
      
      setResolvedMode(newResolvedMode);
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);
    
    // Legacy support
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [themeMode]);

  // Set theme function with persistence
  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  };

  // Toggle between light and dark (doesn't use system mode)
  const toggleTheme = () => {
    const newMode: ThemeMode = resolvedMode === 'light' ? 'dark' : 'light';
    setTheme(newMode);
  };

  const theme: Theme = {
    mode: themeMode,
    resolvedMode,
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

