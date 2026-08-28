/**
 * ProtectedRoute - Route guard for authenticated pages.
 * 
 * Redirects unauthenticated users to the login page.
 * Shows loading state while authentication is being determined.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { AuthLoading } from '../../features/auth/components/AuthLoading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authState } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AuthLoading message="Verifying authentication..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
}
