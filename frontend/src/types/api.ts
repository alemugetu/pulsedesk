/**
 * API-related types and error representations.
 */

import type { ID } from './common';

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Request configuration
export interface ApiRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeout?: number;
  signal?: AbortSignal;
}

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Generic resource response
export interface ResourceResponse {
  id: ID;
  created_at: string;
  updated_at: string;
}

// Common API request patterns
export interface ListResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CreateResponse {
  id: ID;
}

export interface UpdateResponse {
  id: ID;
}

export interface DeleteResponse {
  success: boolean;
  message?: string;
}
