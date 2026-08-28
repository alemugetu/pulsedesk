/**
 * VerifyEmailPage - Email verification page.
 * 
 * Handles email verification via token from URL.
 * Also provides option to resend verification email.
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Mail, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../../features/auth/components/AuthLayout';
import { AuthCard } from '../../features/auth/components/AuthCard';
import { AuthFormField } from '../../features/auth/components/AuthFormField';
import { AuthError } from '../../features/auth/components/AuthError';
import { AuthLoading } from '../../features/auth/components/AuthLoading';
import { Button } from '../../components/ui/Button';
import { useEmailVerification } from '../../features/auth/hooks/useEmailVerification';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [showResend, setShowResend] = useState(!token);
  const [isVerified, setIsVerified] = useState(false);

  const {
    email,
    errors,
    isLoading,
    serverError,
    handleEmailChange,
    handleVerify,
    handleResend,
    clearError,
  } = useEmailVerification();

  const handleVerifyClick = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleVerify(token);
      setIsVerified(true);
    } catch {
      // Error handled by hook
    }
  };

  const handleResendClick = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleResend(e);
      setIsVerified(true);
    } catch {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthLoading message="Verifying your email..." />
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isVerified) {
    return (
      <AuthLayout>
        <AuthCard title="Email verified">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Verification successful
              </h3>
              <p className="text-muted-foreground">
                Your email has been verified. You can now sign in to your account.
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
        title={showResend ? 'Resend verification email' : 'Verify your email'}
        description={
          showResend
            ? "Enter your email address and we'll send you a new verification link"
            : 'Click the button below to verify your email address'
        }
      >
        <form onSubmit={showResend ? handleResendClick : handleVerifyClick} className="space-y-6">
          <AuthError message={serverError} />

          {showResend ? (
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
          ) : (
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-md">
              <Mail className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Verification link detected</p>
                <p>We found a verification token in the URL. Click below to complete verification.</p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading}
          >
            {showResend ? (
              <>
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                Resend verification email
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Verify email
              </>
            )}
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

          {!showResend && (
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setShowResend(true)}
                className="text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
              >
                Didn't receive the email? Resend verification
              </button>
            </div>
          )}
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
