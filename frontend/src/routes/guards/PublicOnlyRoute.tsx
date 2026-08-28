/**
 * PublicOnlyRoute - Route guard for public-only pages.
 * 
 * Redirects authenticated users away from login/register pages.
 * Shows loading state while authentication is being determined.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { AuthLoading } from '../../features/auth/components/AuthLoading';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function PublicOnlyRoute({ children, redirectTo = '/app' }: PublicOnlyRouteProps) {
  const { authState } = useAuth();

  // Show loading state while checking authentication
  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AuthLoading message="Loading..." />
      </div>
    );
  }

  // Redirect to app if already authenticated
  if (authState.isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Render public content if not authenticated
  return <>{children}</>;
}
