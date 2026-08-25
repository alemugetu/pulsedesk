/**
 * Routes index for PulseDesk.
 * 
 * Exports the route configuration and provides routing setup.
 */

import { createBrowserRouter } from 'react-router-dom';
import { routeConfig } from './routeConfig';

/**
 * Create and export the router instance.
 * This uses React Router's createBrowserRouter for the router.
 */
export const router = createBrowserRouter(routeConfig);
