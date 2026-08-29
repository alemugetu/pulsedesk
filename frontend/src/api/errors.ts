/**
 * API error normalization and handling.
 * Converts Axios errors into a predictable frontend error representation.
 */

import type { AxiosError } from 'axios';

// Local types for error handling
export const ApiErrorType = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ApiErrorType = typeof ApiErrorType[keyof typeof ApiErrorType];

export interface ApiError {
  type: ApiErrorType;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
  originalError?: unknown;
}

/**
 * Normalize Axios errors into a consistent ApiError format.
 */
export function normalizeApiError(error: unknown): ApiError {
  // If it's already an ApiError, return it
  if (isApiError(error)) {
    return error;
  }

  // Handle Axios errors
  if (isAxiosError(error)) {
    return normalizeAxiosError(error);
  }

  // Handle network errors (no response)
  if (error instanceof Error) {
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return {
        type: ApiErrorType.NETWORK,
        message: 'Network error. Please check your connection.',
        originalError: error,
      };
    }

    // Handle generic errors
    return {
      type: ApiErrorType.UNKNOWN,
      message: error.message || 'An unexpected error occurred',
      originalError: error,
    };
  }

  // Handle unknown error types
  return {
    type: ApiErrorType.UNKNOWN,
    message: 'An unexpected error occurred',
    originalError: error,
  };
}

/**
 * Normalize Axios-specific errors.
 */
function normalizeAxiosError(error: AxiosError): ApiError {
  const { response, request } = error;

  // No response indicates network error
  if (!response && request) {
    return {
      type: ApiErrorType.NETWORK,
      message: 'Network error. Please check your connection.',
      originalError: error,
    };
  }

  // No request indicates request setup error
  if (!request) {
    return {
      type: ApiErrorType.UNKNOWN,
      message: 'Request setup error',
      originalError: error,
    };
  }

  // Handle response-based errors
  const status = response?.status;
  const data = response?.data;

  // Handle validation errors (400)
  if (status === 400) {
    const fieldErrors = extractFieldErrors(data);
    return {
      type: ApiErrorType.VALIDATION,
      message: fieldErrors ? 'Please correct the highlighted fields' : 'Invalid request data',
      statusCode: status,
      fieldErrors,
      details: data as Record<string, unknown>,
      originalError: error,
    };
  }

  // Handle authentication errors (401)
  if (status === 401) {
    return {
      type: ApiErrorType.AUTHENTICATION,
      message: 'Authentication required. Please log in.',
      statusCode: status,
      details: data as Record<string, unknown>,
      originalError: error,
    };
  }

  // Handle authorization errors (403)
  if (status === 403) {
    return {
      type: ApiErrorType.AUTHORIZATION,
      message: 'You do not have permission to perform this action.',
      statusCode: status,
      details: data as Record<string, unknown>,
      originalError: error,
    };
  }

  // Handle not found errors (404)
  if (status === 404) {
    return {
      type: ApiErrorType.NOT_FOUND,
      message: 'The requested resource was not found.',
      statusCode: status,
      details: data as Record<string, unknown>,
      originalError: error,
    };
  }

  // Handle server errors (500+)
  if (status && status >= 500) {
    return {
      type: ApiErrorType.SERVER_ERROR,
      message: 'Server error. Please try again later.',
      statusCode: status,
      details: data as Record<string, unknown>,
      originalError: error,
    };
  }

  // Default for other status codes
  const errorMessage = (data as Record<string, unknown>)?.detail ||
    (data as Record<string, unknown>)?.message ||
    'An error occurred';
  return {
    type: ApiErrorType.UNKNOWN,
    message: errorMessage as string,
    statusCode: status,
    details: data as Record<string, unknown>,
    originalError: error,
  };
}

/**
 * Extract field errors from Django REST Framework error format.
 */
function extractFieldErrors(data: unknown): Record<string, string[]> | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const errors: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'detail' || key === 'non_field_errors') {
      continue; // Skip general error fields
    }

    if (Array.isArray(value)) {
      errors[key] = value.map(String);
    } else if (typeof value === 'string') {
      errors[key] = [value];
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested errors
      const nested = extractFieldErrors(value);
      if (nested) {
        Object.assign(errors, nested);
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}

/**
 * Type guards
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    Object.values(ApiErrorType).includes((error as ApiError).type)
  );
}

/**
 * Helper to get user-friendly error message
 */
export function getErrorMessage(error: ApiError): string {
  return error.message;
}

/**
 * Helper to get a specific field error from an ApiError
 */
export function getFieldError(error: ApiError, field: string): string | undefined {
  if (error.fieldErrors && error.fieldErrors[field] && error.fieldErrors[field].length > 0) {
    return error.fieldErrors[field][0];
  }
  return undefined;
}

/**
 * Helper to check if error is retriable
 */
export function isRetriableError(error: ApiError): boolean {
  return (
    error.type === ApiErrorType.NETWORK ||
    error.type === ApiErrorType.SERVER_ERROR ||
    (error.statusCode !== undefined && error.statusCode >= 500)
  );
}
