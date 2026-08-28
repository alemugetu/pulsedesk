/**
 * Authentication types for PulseDesk.
 * 
 * Defines TypeScript interfaces for authentication data structures
 * matching the backend API contract.
 */

/**
 * User registration request
 */
export interface UserRegistrationRequest {
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
}

/**
 * User registration response
 */
export interface UserRegistrationResponse {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_verified: boolean;
}

/**
 * User login request
 */
export interface UserLoginRequest {
  email: string;
  password: string;
}

/**
 * Token response from login/refresh
 */
export interface TokenResponse {
  access: string;
  refresh: string;
}

/**
 * User login response (returns tokens)
 */
export type UserLoginResponse = TokenResponse;

/**
 * Logout request
 */
export interface LogoutRequest {
  refresh: string;
}

/**
 * User profile response
 */
export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_verified: boolean;
}

/**
 * Email verification request
 */
export interface EmailVerificationRequest {
  token: string;
}

/**
 * Resend verification email request
 */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirm request
 */
export interface PasswordResetConfirmRequest {
  user_id: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  error: string | null;
}

/**
 * Authentication context value
 */
export interface AuthContextValue {
  authState: AuthState;
  login: (credentials: UserLoginRequest) => Promise<void>;
  register: (data: UserRegistrationRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (data: PasswordResetConfirmRequest) => Promise<void>;
  clearError: () => void;
}

/**
 * Form errors type
 */
export interface FormErrors {
  [key: string]: string[];
}

/**
 * API error response
 */
export interface ApiError {
  message: string;
  errors?: FormErrors;
  status?: number;
}
