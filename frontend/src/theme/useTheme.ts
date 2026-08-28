/**
 * useTheme hook for accessing and manipulating the theme.
 * 
 * Provides a convenient interface for components to:
 * - Access current theme state
 * - Change theme mode
 * - Toggle between light/dark
 */

import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import type { ThemeContextValue } from './ThemeContext';

/**
 * Internal hook to access the theme context.
 */
function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to access and control the theme.
 */
export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeContext();

  return {
    // Current theme state
    theme,
    mode: theme.mode,
    resolvedMode: theme.resolvedMode,
    isDark: theme.resolvedMode === 'dark',
    isLight: theme.resolvedMode === 'light',
    isSystem: theme.mode === 'system',
    
    // Theme control
    setTheme,
    toggleTheme,
    
    // Convenience methods
    setLight: () => setTheme('light'),
    setDark: () => setTheme('dark'),
    setSystem: () => setTheme('system'),
  };
}

/**
 * Type for the useTheme hook return value.
 */
export type UseThemeReturn = ReturnType<typeof useTheme>;
