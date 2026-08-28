/**
 * Login Hook for PulseDesk.
 * 
 * Provides login-specific functionality for the login page.
 */

import { useState } from 'react';
import { useAuth } from './useAuth';
import type { UserLoginRequest } from '../types/auth';

export function useLogin() {
  const { login, authState, clearError } = useAuth();
  const [credentials, setCredentials] = useState<UserLoginRequest>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!credentials.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!credentials.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    clearError();
    
    if (!validate()) {
      return;
    }

    try {
      await login(credentials);
    } catch (error) {
      // Error is handled by useAuth
    }
  };

  return {
    credentials,
    errors,
    isLoading: authState.isLoading,
    serverError: authState.error,
    handleChange,
    handleSubmit,
    clearError,
  };
}
