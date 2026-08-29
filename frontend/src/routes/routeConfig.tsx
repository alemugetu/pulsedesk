/**
 * Route configuration for PulseDesk.
 * 
 * Defines the route structure supporting:
 * - Public routes (landing, about, features, etc.)
 * - Authentication routes (login, register, password management)
 * - Protected application routes (dashboard, incidents, reports, settings)
 * 
 * Phase 13.2: Public routes implemented with PublicLayout
 * Phase 13.3: Authentication routes implemented with route guards
 * Phase 13.4: Application shell with AppLayout and protected app routes implemented
 */

import { type RouteObject } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { PublicLayout } from '../layouts/public/PublicLayout';
import { AuthPageLayout } from '../layouts/auth/AuthPageLayout';
import { AppLayout } from '../layouts/app/AppLayout';
import { ProtectedRoute } from './guards/ProtectedRoute';
import { PublicOnlyRoute } from './guards/PublicOnlyRoute';
import { Placeholder } from './Placeholder';
import { HomePage } from '../pages/public/HomePage';
import { AboutPage } from '../pages/public/AboutPage';
import { FeaturesPage } from '../pages/public/FeaturesPage';
import { ContactPage } from '../pages/public/ContactPage';
import { PrivacyPage } from '../pages/public/PrivacyPage';
import { TermsPage } from '../pages/public/TermsPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AppHomePage } from '../pages/app/AppHomePage';
import { OrganizationsPage } from '../pages/organizations/OrganizationsPage';
import { OrganizationPage } from '../pages/organizations/OrganizationPage';
import { IncidentsPage } from '../pages/app/IncidentsPage';
import { IncidentDetailPage } from '../pages/app/IncidentDetailPage';
import { CreateIncidentPage } from '../pages/app/CreateIncidentPage';
import { OperationsCommandCenterPage } from '../features/operations/pages/OperationsCommandCenterPage';

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
 * Phase 13.3: Full authentication implementation with public-only route guards
 */
const authRoutes: RouteObject[] = [
  {
    element: <AuthPageLayout />,
    children: [
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/register',
        element: (
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/verify-email',
        element: (
          <PublicOnlyRoute>
            <VerifyEmailPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        ),
      },
    ],
  },
];

/**
 * Protected application routes - require authentication
 * Phase 13.4: Application shell with AppLayout and AppHomePage implemented
 * Phase 13.5: Organization routes added
 * Phase 13.6: Incident routes added
 * Phase 13.9: Operations Command Center route added
 */
const protectedRoutes: RouteObject[] = [
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <AppHomePage />,
      },
      {
        path: 'organizations',
        element: <OrganizationsPage />,
      },
      {
        path: 'organizations/:organizationId',
        element: <OrganizationPage />,
      },
      {
        path: 'incidents',
        element: <IncidentsPage />,
      },
      {
        path: 'incidents/new',
        element: <CreateIncidentPage />,
      },
      {
        path: 'incidents/:incidentId',
        element: <IncidentDetailPage />,
      },
      {
        path: 'operations',
        element: <OperationsCommandCenterPage />,
      },
      // Future app routes will be added here in later phases
      // Examples: /app/dashboard, /app/reports, /app/settings, etc.
    ],
  },
];

/**
 * Complete route configuration
 * Phase 13.3: Public routes fully implemented, authentication routes with guards implemented
 * Phase 13.4: Application shell with AppLayout and protected app routes implemented
 * Phase 13.5: Organization routes added
 * Phase 13.6: Incident routes added
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
