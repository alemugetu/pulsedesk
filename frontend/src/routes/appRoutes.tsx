/**
 * App-specific routes for PulseDesk.
 * 
 * This file is reserved for future modular route organization.
 * Currently, app routes are defined inline in routeConfig.tsx for simplicity.
 * 
 * Phase 13.4: Application shell routes with AppLayout
 */

import { type RouteObject } from 'react-router-dom';
import { AppLayout } from '../layouts/app/AppLayout';
import { AppHomePage } from '../pages/app/AppHomePage';

/**
 * Protected application routes
 * All routes under /app require authentication and use AppLayout
 * 
 * Note: This is exported for potential future use but currently
 * the routes are defined inline in routeConfig.tsx
 */
export const appRoutes: RouteObject = {
  element: <AppLayout />,
  children: [
    {
      index: true,
      element: <AppHomePage />,
    },
    // Future app routes will be added here in later phases:
    // - /app/organizations
    // - /app/incidents
    // - /app/operations
    // - /app/reports
    // - /app/settings
    // - /app/audit
  ],
};
