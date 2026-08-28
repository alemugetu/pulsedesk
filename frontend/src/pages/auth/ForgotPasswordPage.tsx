/**
 * ForgotPasswordPage - Password reset request page.
 * 
 * Allows users to request a password reset email.
 * For security, returns a generic response regardless of whether the email exists.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ArrowLeft, Mail } from 'lucide-react';
import { AuthLayout } from '../../features/auth/components/AuthLayout';
import { AuthCard } from '../../features/auth/components/AuthCard';
import { AuthFormField } from '../../features/auth/components/AuthFormField';
import { AuthError } from '../../features/auth/components/AuthError';
import { AuthLoading } from '../../features/auth/components/AuthLoading';
import { Button } from '../../components/ui/Button';
import { usePasswordReset } from '../../features/auth/hooks/usePasswordReset';

export function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    email,
    errors,
    isLoading,
    serverError,
    handleEmailChange,
    handleRequestReset,
    clearError,
  } = usePasswordReset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleRequestReset(e);
      setIsSuccess(true);
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthLoading message="Sending reset instructions..." />
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout>
        <AuthCard title="Check your email">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <Mail className="h-16 w-16 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Reset link sent
              </h3>
              <p className="text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, you'll receive a password reset link via email shortly.
              </p>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• The link will expire in a few hours</p>
              <p>• Check your spam folder if you don't see it</p>
            </div>
            <Button asChild fullWidth>
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back to sign in
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
        title="Reset your password"
        description="Enter your email and we'll send you a reset link"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <AuthError message={serverError} />

          <AuthFormField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            error={errors.email}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={isLoading}
            autoFocus
          />

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading}
          >
            <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
            Send reset link
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
