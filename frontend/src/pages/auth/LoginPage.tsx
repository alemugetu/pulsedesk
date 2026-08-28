/**
 * LoginPage - User login page.
 * 
 * Provides login form with email and password fields.
 * Includes links to registration and forgot password pages.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthLayout } from '../../features/auth/components/AuthLayout';
import { AuthCard } from '../../features/auth/components/AuthCard';
import { AuthFormField } from '../../features/auth/components/AuthFormField';
import { AuthError } from '../../features/auth/components/AuthError';
import { Button } from '../../components/ui/Button';
import { useLogin } from '../../features/auth/hooks/useLogin';
import { useAuth } from '../../features/auth/hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const {
    credentials,
    errors,
    isLoading,
    serverError,
    handleChange,
    handleSubmit,
    clearError,
  } = useLogin();

  // Redirect if already authenticated
  useEffect(() => {
    if (authState.isAuthenticated && !authState.isLoading) {
      navigate('/app', { replace: true });
    }
  }, [authState.isAuthenticated, authState.isLoading, navigate]);

  return (
    <AuthLayout>
      <AuthCard
        title="Welcome back"
        description="Sign in to your PulseDesk account"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <AuthError message={serverError} />

          <AuthFormField
            label="Email"
            name="email"
            type="email"
            value={credentials.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={isLoading}
            autoFocus
          />

          <AuthFormField
            label="Password"
            name="password"
            type="password"
            value={credentials.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            disabled={isLoading}
          />

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-primary hover:text-primary-hover focus:outline-none focus:underline"
                onClick={clearError}
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            disabled={isLoading}
          >
            <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign in
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link
              to="/register"
              className="font-medium text-primary hover:text-primary-hover focus:outline-none focus:underline"
              onClick={clearError}
            >
              Sign up
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
