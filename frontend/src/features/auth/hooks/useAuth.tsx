/**
 * useAuth hook for PulseDesk.
 *
 * Provides access to the authentication context.
 * The AuthContext is defined in AuthContext.tsx alongside the AuthProvider.
 */

import { useContext } from 'react';
import { AuthContext } from './authContextDef';
import type { AuthContextValue } from '../types/auth';

/**
 * Hook to use authentication context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
