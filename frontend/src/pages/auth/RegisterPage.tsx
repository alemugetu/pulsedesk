/**
 * RegisterPage - User registration page.
 * 
 * Provides registration form with email, password, and optional name fields.
 * Includes link to login page.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '../../features/auth/components/AuthLayout';
import { AuthCard } from '../../features/auth/components/AuthCard';
import { AuthFormField } from '../../features/auth/components/AuthFormField';
import { AuthError } from '../../features/auth/components/AuthError';
import { Button } from '../../components/ui/Button';
import { useRegister } from '../../features/auth/hooks/useRegister';
import { useAuth } from '../../features/auth/hooks/useAuth';

export function RegisterPage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const {
    formData,
    errors,
    isLoading,
    serverError,
    handleChange,
    handleSubmit,
    clearError,
  } = useRegister();

  // Redirect if already authenticated
  useEffect(() => {
    if (authState.isAuthenticated && !authState.isLoading) {
      navigate('/app', { replace: true });
    }
  }, [authState.isAuthenticated, authState.isLoading, navigate]);

  return (
    <AuthLayout>
      <AuthCard
        title="Create your account"
        description="Get started with PulseDesk today"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <AuthError message={serverError} />

          <AuthFormField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={isLoading}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-4">
            <AuthFormField
              label="First name"
              name="first_name"
              type="text"
              value={formData.first_name || ''}
              onChange={handleChange}
              error={errors.first_name}
              placeholder="John"
              autoComplete="given-name"
              disabled={isLoading}
            />

            <AuthFormField
              label="Last name"
              name="last_name"
              type="text"
              value={formData.last_name || ''}
              onChange={handleChange}
              error={errors.last_name}
              placeholder="Doe"
              autoComplete="family-name"
              disabled={isLoading}
            />
          </div>

          <AuthFormField
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <AuthFormField
            label="Confirm password"
            name="password_confirm"
            type="password"
            value={formData.password_confirm}
            onChange={handleChange}
            error={errors.password_confirm}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading}
          >
            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Create account
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link
              to="/login"
              className="font-medium text-primary hover:text-primary-hover focus:outline-none focus:underline"
              onClick={clearError}
            >
              Sign in
            </Link>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-md">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Email verification required</p>
                <p>You'll receive a verification email after registration. Please verify your email before signing in.</p>
              </div>
            </div>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
