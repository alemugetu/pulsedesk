/**
 * AuthPageLayout - Layout for authentication pages.
 * 
 * Provides a simple layout wrapper for authentication pages.
 * Authentication pages use their own specialized layout (AuthLayout component)
 * rather than the public navbar/footer.
 */

import { Outlet } from 'react-router-dom';

export function AuthPageLayout() {
  return <Outlet />;
}
