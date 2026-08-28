/**
 * Theme context for PulseDesk.
 *
 * Holds the React context for theme state, separated from the provider
 * component to avoid Fast Refresh warnings.
 */

import { createContext } from 'react';
import type { ThemeMode, Theme } from './theme';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
