/**
 * Email Verification Hook for PulseDesk.
 * 
 * Provides email verification functionality for the verify email page.
 */

import { useState } from 'react';
import { useAuth } from './useAuth';

export function useEmailVerification() {
  const { verifyEmail, resendVerification, authState, clearError } = useAuth();
  const [email, setEmail] = useState('');
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

  const handleVerify = async (token: string) => {
    clearError();
    
    if (!token) {
      setErrors({ token: 'Verification token is required' });
      return;
    }

    try {
      await verifyEmail(token);
    } catch {
      // Error is handled by useAuth
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    clearError();
    
    if (!validateEmail()) {
      return;
    }

    try {
      await resendVerification(email);
    } catch {
      // Error is handled by useAuth
    }
  };

  return {
    email,
    errors,
    isLoading: authState.isLoading,
    serverError: authState.error,
    setEmail,
    handleEmailChange,
    handleVerify,
    handleResend,
    clearError,
  };
}
