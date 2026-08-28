/**
 * ResetPasswordPage - Password reset confirmation page.
 * 
 * Allows users to set a new password using the token from the reset email.
 * Handles both the GET validation and POST confirmation of the reset.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Lock, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../../features/auth/components/AuthLayout';
import { AuthCard } from '../../features/auth/components/AuthCard';
import { AuthFormField } from '../../features/auth/components/AuthFormField';
import { AuthError } from '../../features/auth/components/AuthError';
import { AuthLoading } from '../../features/auth/components/AuthLoading';
import { Button } from '../../components/ui/Button';
import { usePasswordReset } from '../../features/auth/hooks/usePasswordReset';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Derive invalid token state from URL params during render
  const token = searchParams.get('token');
  const userId = searchParams.get('user_id');
  const isInvalidToken = !token || !userId;

  const {
    resetData,
    setResetData,
    errors,
    isLoading,
    serverError,
    handleResetDataChange,
    handleConfirmReset,
    clearError,
  } = usePasswordReset();

  // Get token and user_id from URL on mount
  useEffect(() => {
    if (token && userId) {
      setResetData(prev => ({ ...prev, token, user_id: userId }));
    }
  }, [token, userId, setResetData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleConfirmReset(e);
      setIsSuccess(true);
    } catch {
      // Error handled by hook
    }
  };

  if (isInvalidToken) {
    return (
      <AuthLayout>
        <AuthCard title="Invalid reset link">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-red-500" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Invalid or expired link
              </h3>
              <p className="text-muted-foreground">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>
            <Button asChild fullWidth>
              <Link to="/forgot-password">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Request new reset link
              </Link>
            </Button>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isLoading) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthLoading message="Resetting your password..." />
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout>
        <AuthCard title="Password reset successful">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Password updated
              </h3>
              <p className="text-muted-foreground">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
            </div>
            <Button asChild fullWidth>
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Go to sign in
              </Link>
            </Button>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Set new password"
        description="Enter your new password below"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <AuthError message={serverError} />

          <AuthFormField
            label="New password"
            name="new_password"
            type="password"
            value={resetData.new_password}
            onChange={handleResetDataChange}
            error={errors.new_password}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            disabled={isLoading}
            autoFocus
          />

          <AuthFormField
            label="Confirm new password"
            name="new_password_confirm"
            type="password"
            value={resetData.new_password_confirm}
            onChange={handleResetDataChange}
            error={errors.new_password_confirm}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Password requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>At least 8 characters</li>
              <li>Include both letters and numbers</li>
              <li>Include special characters for stronger security</li>
            </ul>
          </div>

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading}
          >
            <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset password
          </Button>

          <div className="text-center text-sm">
            <Link
              to="/login"
              className="font-medium text-primary hover:text-primary-hover focus:outline-none focus:underline"
              onClick={clearError}
            >
              <ArrowLeft className="mr-1 h-4 w-4 inline" aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
