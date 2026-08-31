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
 * Phase 13.11: Reports route enabled.
 * Phase 13.12: Settings route enabled.
 * Phase 13.13: Audit Logs route enabled.
 */

import { Home, Gauge, Settings, FileText, Building2, AlertTriangle, ScrollText, Shield, Siren, FolderOpen, KeyRound } from 'lucide-react';
import type { NavigationConfig, NavigationGroup, NavigationItem } from './navigation.types';

/**
 * Main navigation items for the authenticated application
 * Phase 13.4: Only includes currently implemented/placeholder routes
 * Phase 13.5: Organizations route added
 * Phase 13.6: Incidents route added
 * Phase 13.9: Operations route added
 * Phase 13.11: Reports route added
 * Phase 13.12: Settings route added
 * Phase 13.13: Audit Logs route added
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
  {
    id: 'reports',
    label: 'Reports',
    path: '/app/reports',
    icon: FileText,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to reports page',
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    path: '/app/audit',
    icon: ScrollText,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to audit logs page',
  },
];

/**
 * Settings navigation items
 * Phase 13.4: Placeholder for future settings implementation
 * Phase 13.12: Enabled for Organization Settings
 */
const settingsNavigationItems: NavigationItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/app/settings',
    icon: Settings,
    visibility: 'authenticated',
    disabled: false,
    ariaLabel: 'Navigate to organization settings',
  },
];

/**
 * Operations & configuration navigation items
 * Phase 13.14: Added SLA policies, escalation policies, incident categories,
 * and roles for backend-driven configuration across the platform.
 */
const configurationNavigationItems: NavigationItem[] = [
  {
    id: 'sla',
    label: 'SLA Policies',
    path: '/app/sla',
    icon: Siren,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to SLA policies',
  },
  {
    id: 'escalation',
    label: 'Escalation Policies',
    path: '/app/escalation',
    icon: Shield,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to escalation policies',
  },
  {
    id: 'incident-categories',
    label: 'Incident Categories',
    path: '/app/categories',
    icon: FolderOpen,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to incident categories',
  },
  {
    id: 'roles',
    label: 'Roles & Permissions',
    path: '/app/roles',
    icon: KeyRound,
    visibility: 'authenticated',
    ariaLabel: 'Navigate to roles and permissions',
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
    id: 'configuration',
    label: 'Configuration',
    items: configurationNavigationItems,
  },
  {
    id: 'settings',
    label: 'Settings',
    items: settingsNavigationItems,
  },
];

/**
 * Complete navigation configuration
 * Phase 13.12: Reports moved to main navigation, Settings enabled
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
