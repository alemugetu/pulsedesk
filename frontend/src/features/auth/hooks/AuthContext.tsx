/**
 * Authentication Context and Provider for PulseDesk.
 *
 * Provides centralized authentication state and operations.
 * This is the single source of truth for authentication in the application.
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { hasTokens, initializeToken } from '../services/tokenService';
import type { AuthState, AuthContextValue, UserLoginRequest, UserRegistrationRequest, PasswordResetConfirmRequest } from '../types/auth';
import type { ApiError } from '../../../api/errors';
import { AuthContext } from './authContextDef';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Initialize authentication state on mount
  useEffect(() => {
    const initAuth = async () => {
      initializeToken();
      
      if (hasTokens()) {
        try {
          const user = await authService.getProfile();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            error: null,
          });
        } catch {
          // Token is invalid, clear it
          authService.logout();
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: 'Session expired. Please login again.',
          });
        }
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: UserLoginRequest) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.login(credentials);
      const user = await authService.getProfile();
      
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as unknown as ApiError).message || 'Login failed. Please check your credentials.'
        : 'Login failed. Please check your credentials.';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const register = useCallback(async (data: UserRegistrationRequest) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.register(data);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as unknown as ApiError).message || 'Registration failed. Please try again.'
        : 'Registration failed. Please try again.';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      await authService.refreshToken();
      const user = await authService.getProfile();
      
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      });
    } catch (error) {
      // Refresh failed, user needs to login again
      await logout();
      throw error;
    }
  }, [logout]);

  const verifyEmail = useCallback(async (token: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.verifyEmail(token);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as unknown as ApiError).message || 'Email verification failed. The link may be expired.'
        : 'Email verification failed. The link may be expired.';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.resendVerification(email);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as unknown as ApiError).message || 'Failed to resend verification email.'
        : 'Failed to resend verification email.';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.requestPasswordReset(email);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as unknown as ApiError).message || 'Failed to request password reset.'
        : 'Failed to request password reset.';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const confirmPasswordReset = useCallback(async (data: PasswordResetConfirmRequest) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await authService.confirmPasswordReset(data);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as unknown as ApiError).message || 'Password reset failed. The link may be expired.'
        : 'Password reset failed. The link may be expired.';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextValue = {
    authState,
    login,
    register,
    logout,
    refreshToken,
    verifyEmail,
    resendVerification,
    requestPasswordReset,
    confirmPasswordReset,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
