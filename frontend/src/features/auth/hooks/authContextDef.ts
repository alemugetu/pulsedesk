/**
 * Authentication context definition for PulseDesk.
 *
 * Holds only the React context object, separated from the provider
 * component to avoid Fast Refresh warnings.
 */

import { createContext } from 'react';
import type { AuthContextValue } from '../types/auth';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
