/**
 * Route configuration for PulseDesk.
 * 
 * Defines the route structure supporting:
 * - Public routes (landing, about, features, etc.)
 * - Authentication routes (login, register, password management)
 * - Protected application routes (dashboard, incidents, reports, settings)
 * 
 * Phase 13.1: Route placeholders only - actual pages will be implemented in later phases.
 */

import { type RouteObject } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { Placeholder } from './Placeholder';

/**
 * Public routes - accessible without authentication
 * Future: /, /about, /features, /contact, /privacy, /terms
 */
const publicRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Placeholder message="Landing Page - Coming Soon" />,
  },
];

/**
 * Authentication routes - login, register, password management
 * Future: /login, /register, /verify-email, /forgot-password, /reset-password
 */
const authRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <Placeholder message="Login Page - Coming Soon" />,
  },
  {
    path: '/register',
    element: <Placeholder message="Register Page - Coming Soon" />,
  },
];

/**
 * Protected application routes - require authentication
 * Future: /app, /app/dashboard, /app/incidents, /app/reports, /app/settings
 */
const protectedRoutes: RouteObject[] = [
  {
    path: '/app',
    element: <Placeholder message="Dashboard - Coming Soon" />,
  },
];

/**
 * Complete route configuration
 * Phase 13.1: Using placeholder routes to verify routing works
 * Routes are wrapped with RootLayout for structural foundation
 */
export const routeConfig: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      ...publicRoutes,
      ...authRoutes,
      ...protectedRoutes,
      {
        path: '*',
        element: <Placeholder message="404 - Page Not Found" />,
      },
    ],
  },
];
