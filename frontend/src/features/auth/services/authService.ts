/**
 * Authentication Service for PulseDesk.
 * 
 * Handles all authentication API calls to the backend.
 * Uses the existing centralized API client.
 */

import { api } from '../../../api/client';
import { setTokens, clearTokens, getRefreshToken } from './tokenService';
import type {
  UserRegistrationRequest,
  UserRegistrationResponse,
  UserLoginRequest,
  UserLoginResponse,
  LogoutRequest,
  UserProfile,
  PasswordResetConfirmRequest,
  TokenResponse,
} from '../types/auth';

/**
 * Register a new user
 */
export async function register(data: UserRegistrationRequest): Promise<UserRegistrationResponse> {
  const response = await api.post<UserRegistrationResponse>('/api/v1/auth/register/', data);
  return response;
}

/**
 * Login user
 */
export async function login(credentials: UserLoginRequest): Promise<UserLoginResponse> {
  const response = await api.post<UserLoginResponse>('/api/v1/auth/login/', credentials);
  
  // Store tokens immediately after successful login
  setTokens(response);
  
  return response;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  
  if (refreshToken) {
    try {
      const logoutRequest: LogoutRequest = { refresh: refreshToken };
      await api.post<void>('/api/v1/auth/logout/', logoutRequest);
    } catch (error) {
      // Continue with local cleanup even if server logout fails
      console.error('Server logout failed:', error);
    }
  }
  
  // Always clear local tokens
  clearTokens();
}

/**
 * Refresh access token
 */
export async function refreshToken(): Promise<TokenResponse> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await api.post<TokenResponse>('/api/v1/auth/token/refresh/', {
    refresh: refreshToken,
  });
  
  // Update stored tokens
  setTokens(response);
  
  return response;
}

/**
 * Get current user profile
 */
export async function getProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>('/api/v1/auth/me/');
  return response;
}

/**
 * Verify email address
 */
export async function verifyEmail(token: string): Promise<void> {
  await api.post<void>('/api/v1/auth/verify-email/', { token });
}

/**
 * Resend verification email
 */
export async function resendVerification(email: string): Promise<void> {
  await api.post<void>('/api/v1/auth/resend-verification/', { email });
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post<void>('/api/v1/auth/password-reset/request/', { email });
}

/**
 * Confirm password reset
 */
export async function confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<void> {
  await api.post<void>('/api/v1/auth/password-reset/confirm/', data);
}
