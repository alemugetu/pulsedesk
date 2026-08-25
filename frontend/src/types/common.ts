/**
 * Common shared types used across the application.
 */

// Generic ID type - can be string or number depending on backend
export type ID = string | number;

// Common async/UI states
export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncStateData<T> {
  state: AsyncState;
  data?: T;
  error?: Error;
}

// Pagination foundation
export interface PaginationParams {
  page?: number;
  page_size?: number;
  ordering?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Common UI states
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  error?: Error;
  message?: string;
}

// Form states
export type FormState = 'pristine' | 'dirty' | 'submitting' | 'success' | 'error';

export interface FieldError {
  field: string;
  message: string;
}

export interface FormErrors {
  [field: string]: string[];
}

// Selection states
export interface SelectionState<T> {
  selected: Set<ID>;
  selectedItems: T[];
  toggleSelection: (item: T) => void;
  clearSelection: () => void;
  selectAll: (items: T[]) => void;
}

// Sorting
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Filtering
export interface FilterConfig {
  [key: string]: unknown;
}
