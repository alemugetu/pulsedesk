/**
 * Incident routes for PulseDesk.
 * 
 * Modular route configuration for incident management.
 * These routes are integrated into the main routeConfig.
 * 
 * Phase 13.6: Incident management routes
 */

import { type RouteObject } from 'react-router-dom';
import { IncidentsPage } from '../pages/app/IncidentsPage';
import { IncidentDetailPage } from '../pages/app/IncidentDetailPage';
import { CreateIncidentPage } from '../pages/app/CreateIncidentPage';

/**
 * Incident routes
 * All incident routes require authentication and organization context
 */
export const incidentRoutes: RouteObject[] = [
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
];
