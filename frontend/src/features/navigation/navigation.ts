/**
 * Navigation configuration for PulseDesk application shell.
 * 
 * Provides the central navigation model for the authenticated application.
 * This configuration is consumed by Sidebar, MobileSidebar, and other
 * navigation components to ensure consistency.
 * 
 * Phase 13.4: Initial navigation structure with Home/placeholder items.
 * Phase 13.5: Organizations route added.
 * Phase 13.6: Incidents route added.
 * Phase 13.9: Operations route added (replaces the disabled Dashboard placeholder).
 * Future phases will add: Reports, Settings, Audit.
 */

import { Home, Gauge, Settings, FileText, Building2, AlertTriangle } from 'lucide-react';
import type { NavigationConfig, NavigationGroup, NavigationItem } from './navigation.types';

/**
 * Main navigation items for the authenticated application
 * Phase 13.4: Only includes currently implemented/placeholder routes
 * Phase 13.5: Organizations route added
 * Phase 13.6: Incidents route added
 * Phase 13.9: Operations route added
 */
const mainNavigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/app',
    icon: Home,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to home page',
  },
  {
    id: 'incidents',
    label: 'Incidents',
    path: '/app/incidents',
    icon: AlertTriangle,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to incidents page',
  },
  {
    id: 'organizations',
    label: 'Organizations',
    path: '/app/organizations',
    icon: Building2,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to organizations page',
  },
  {
    id: 'operations',
    label: 'Operations',
    path: '/app/operations',
    icon: Gauge,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to operations command center',
  },
];

/**
 * Settings navigation items
 * Phase 13.4: Placeholder for future settings implementation
 */
const settingsNavigationItems: NavigationItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/app/settings',
    icon: Settings,
    visibility: 'authenticated',
    disabled: true,
    ariaLabel: 'Settings - Coming Soon',
  },
];

/**
 * Reports navigation items
 * Phase 13.4: Placeholder for future reports implementation
 * Phase 13.11: Enabled for Reports & Analytics
 */
const reportsNavigationItems: NavigationItem[] = [
  {
    id: 'reports',
    label: 'Reports',
    path: '/app/reports',
    icon: FileText,
    visibility: 'authenticated',
    disabled: false,
    ariaLabel: 'Navigate to reports page',
  },
];

/**
 * Navigation groups for organized navigation structure
 */
export const navigationGroups: NavigationGroup[] = [
  {
    id: 'main',
    items: mainNavigationItems,
  },
  {
    id: 'reports',
    label: 'Reports',
    items: reportsNavigationItems,
  },
  {
    id: 'settings',
    label: 'Settings',
    items: settingsNavigationItems,
  },
];

/**
 * Complete navigation configuration
 */
export const navigationConfig: NavigationConfig = {
  groups: navigationGroups,
  basePath: '/app',
};

/**
 * Get all navigation items flattened
 * Useful for breadcrumb generation and route matching
 */
export function getAllNavigationItems(): NavigationItem[] {
  const items: NavigationItem[] = [];
  
  for (const group of navigationGroups) {
    for (const item of group.items) {
      items.push(item);
      if (item.children) {
        items.push(...item.children);
      }
    }
  }
  
  return items;
}

/**
 * Find a navigation item by path
 * Used for active route detection and breadcrumb generation
 */
export function findNavigationItemByPath(path: string): NavigationItem | undefined {
  const items = getAllNavigationItems();
  return items.find(item => item.path === path);
}

/**
 * Find a navigation item by ID
 * Used for programmatic navigation
 */
export function findNavigationItemById(id: string): NavigationItem | undefined {
  const items = getAllNavigationItems();
  return items.find(item => item.id === id);
}

/**
 * Get navigation items filtered by visibility
 * Used to show/hide items based on authentication state
 */
export function getVisibleNavigationItems(visibility: 'authenticated' | 'public'): NavigationItem[] {
  const items = getAllNavigationItems();
  return items.filter(item => 
    !item.visibility || item.visibility === 'always' || item.visibility === visibility
  );
}
