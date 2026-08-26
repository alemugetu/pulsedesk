/**
 * Route configuration for PulseDesk.
 * 
 * Defines the route structure supporting:
 * - Public routes (landing, about, features, etc.)
 * - Authentication routes (login, register, password management)
 * - Protected application routes (dashboard, incidents, reports, settings)
 * 
 * Phase 13.2: Public routes implemented with PublicLayout
 */

import { type RouteObject } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { PublicLayout } from '../layouts/public/PublicLayout';
import { Placeholder } from './Placeholder';
import { HomePage } from '../pages/public/HomePage';
import { AboutPage } from '../pages/public/AboutPage';
import { FeaturesPage } from '../pages/public/FeaturesPage';
import { ContactPage } from '../pages/public/ContactPage';
import { PrivacyPage } from '../pages/public/PrivacyPage';
import { TermsPage } from '../pages/public/TermsPage';

/**
 * Public routes - accessible without authentication
 * Phase 13.2: Full public website implementation
 */
const publicRoutes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/about',
        element: <AboutPage />,
      },
      {
        path: '/features',
        element: <FeaturesPage />,
      },
      {
        path: '/contact',
        element: <ContactPage />,
      },
      {
        path: '/privacy',
        element: <PrivacyPage />,
      },
      {
        path: '/terms',
        element: <TermsPage />,
      },
    ],
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
 * Phase 13.2: Public routes fully implemented, auth and protected routes remain as placeholders
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
