/**
 * Centralized Axios API client for PulseDesk.
 * 
 * This provides a clean foundation for API communication.
 * Authentication/token lifecycle will be added in Phase 13.3.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { env } from '../config/env';
import { normalizeApiError } from './errors';

/**
 * Create and configure the Axios instance.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.API_BASE_URL,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor - can be extended for auth in Phase 13.3
  client.interceptors.request.use(
    (config) => {
      // Future: Add authentication headers here
      // const token = getAuthToken();
      // if (token) {
      //   config.headers.Authorization = `Bearer ${token}`;
      // }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - standardize error handling
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      // Normalize all errors through our error handler
      const normalizedError = normalizeApiError(error);
      return Promise.reject(normalizedError);
    }
  );

  return client;
}

// Create singleton instance
const apiClient = createApiClient();

/**
 * HTTP request methods with built-in error normalization.
 */
export const api = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.get<T>(url, config).then((response) => response.data);
  },

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.post<T>(url, data, config).then((response) => response.data);
  },

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.put<T>(url, data, config).then((response) => response.data);
  },

  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.patch<T>(url, data, config).then((response) => response.data);
  },

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.delete<T>(url, config).then((response) => response.data);
  },
};

/**
 * Access to the raw Axios instance for advanced use cases.
 * Use this sparingly - prefer the typed methods above.
 */
export { apiClient };

/**
 * Type-safe request wrapper for custom axios operations.
 */
export async function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.request<T>(config);
  return response.data;
}

/**
 * Set authentication token (for Phase 13.3).
 * This is a placeholder for future authentication implementation.
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

/**
 * Clear authentication token (for Phase 13.3).
 */
export function clearAuthToken(): void {
  delete apiClient.defaults.headers.common['Authorization'];
}

/**
 * Update base URL dynamically (useful for testing or multi-tenancy).
 */
export function setBaseURL(url: string): void {
  apiClient.defaults.baseURL = url;
}

/**
 * Get current base URL.
 */
export function getBaseURL(): string {
  return apiClient.defaults.baseURL as string;
}
