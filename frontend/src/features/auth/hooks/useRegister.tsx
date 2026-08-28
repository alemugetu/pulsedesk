/**
 * Registration Hook for PulseDesk.
 * 
 * Provides registration-specific functionality for the registration page.
 */

import { useState } from 'react';
import { useAuth } from './useAuth';
import type { UserRegistrationRequest } from '../types/auth';

export function useRegister() {
  const { register, authState, clearError } = useAuth();
  const [formData, setFormData] = useState<UserRegistrationRequest>({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.password_confirm) {
      newErrors.password_confirm = 'Please confirm your password';
    } else if (formData.password !== formData.password_confirm) {
      newErrors.password_confirm = 'Passwords do not match';
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
      await register(formData);
    } catch (error) {
      // Error is handled by useAuth
    }
  };

  return {
    formData,
    errors,
    isLoading: authState.isLoading,
    serverError: authState.error,
    handleChange,
    handleSubmit,
    clearError,
  };
}
