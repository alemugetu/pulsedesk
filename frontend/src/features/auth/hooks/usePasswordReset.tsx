/**
 * Password Reset Hook for PulseDesk.
 * 
 * Provides password reset functionality for forgot password and reset password pages.
 */

import { useState } from 'react';
import { useAuth } from './useAuth';
import type { PasswordResetConfirmRequest } from '../types/auth';

export function usePasswordReset() {
  const { requestPasswordReset, confirmPasswordReset, authState, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [resetData, setResetData] = useState<PasswordResetConfirmRequest>({
    user_id: '',
    token: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  };

  const handleResetDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setResetData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateEmail = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateReset = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!resetData.new_password) {
      newErrors.new_password = 'Password is required';
    } else if (resetData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters';
    }

    if (!resetData.new_password_confirm) {
      newErrors.new_password_confirm = 'Please confirm your password';
    } else if (resetData.new_password !== resetData.new_password_confirm) {
      newErrors.new_password_confirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    clearError();
    
    if (!validateEmail()) {
      return;
    }

    try {
      await requestPasswordReset(email);
    } catch (error) {
      // Error is handled by useAuth
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    clearError();
    
    if (!validateReset()) {
      return;
    }

    try {
      await confirmPasswordReset(resetData);
    } catch (error) {
      // Error is handled by useAuth
    }
  };

  return {
    email,
    resetData,
    errors,
    isLoading: authState.isLoading,
    serverError: authState.error,
    setEmail,
    handleEmailChange,
    handleResetDataChange,
    handleRequestReset,
    handleConfirmReset,
    clearError,
  };
}
