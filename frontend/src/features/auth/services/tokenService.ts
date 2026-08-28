/**
 * Token Service for PulseDesk authentication.
 * 
 * Manages JWT token storage, retrieval, and clearing.
 * Integrates with the existing API client for automatic token injection.
 */

import { setAuthToken, clearAuthToken } from '../../../api/client';
import type { TokenResponse } from '../types/auth';

const ACCESS_TOKEN_KEY = 'pulsedesk_access_token';
const REFRESH_TOKEN_KEY = 'pulsedesk_refresh_token';

/**
 * Store authentication tokens
 */
export function setTokens(tokens: TokenResponse): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    
    // Update API client with the new access token
    setAuthToken(tokens.access);
  } catch (error) {
    console.error('Failed to store tokens:', error);
  }
}

/**
 * Get the current access token
 */
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve access token:', error);
    return null;
  }
}

/**
 * Get the current refresh token
 */
export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve refresh token:', error);
    return null;
  }
}

/**
 * Check if user has valid tokens
 */
export function hasTokens(): boolean {
  return getAccessToken() !== null && getRefreshToken() !== null;
}

/**
 * Clear all authentication tokens
 */
export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    
    // Clear the API client's authorization header
    clearAuthToken();
  } catch (error) {
    console.error('Failed to clear tokens:', error);
  }
}

/**
 * Initialize the API client with stored token if available
 * This should be called on app startup
 */
export function initializeToken(): void {
  const accessToken = getAccessToken();
  if (accessToken) {
    setAuthToken(accessToken);
  }
}
