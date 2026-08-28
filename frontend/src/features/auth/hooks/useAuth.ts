/**
 * React hook to access authentication context.
 * 
 * Provides a clean interface for accessing authentication state and operations.
 */

import { useContext } from 'react';
import { AuthContext } from './authContextDef';
import type { AuthContextValue } from '../types/auth';

/**
 * Hook to use authentication context
 * Throws error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
