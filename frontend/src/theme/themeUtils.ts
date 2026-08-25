/**
 * Theme utility functions for PulseDesk.
 * 
 * Helper functions for theme resolution and initialization.
 * Separated to avoid fast refresh warnings in ThemeProvider.
 */

import type { ThemeMode } from './theme';
import { THEME_STORAGE_KEY } from './theme';

/**
 * Resolve the actual theme mode (light or dark) based on user preference and system setting.
 */
export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Get the initial theme mode from localStorage or use default.
 */
export function getInitialThemeMode(defaultTheme: ThemeMode): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
      return stored as ThemeMode;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  return defaultTheme;
}
