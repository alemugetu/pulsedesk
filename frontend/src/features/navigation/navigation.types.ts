/**
 * Navigation types for PulseDesk application shell.
 * 
 * Defines the structure for navigation items used in Sidebar, MobileSidebar,
 * and other navigation components. This provides a typed, extensible model
 * for the application navigation architecture.
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Navigation item visibility control
 */
export type NavigationVisibility = 'always' | 'authenticated' | 'public';

/**
 * Navigation item structure
 */
export interface NavigationItem {
  /** Unique identifier for the navigation item */
  id: string;
  /** Display label for the navigation item */
  label: string;
  /** Route path for the navigation item */
  path: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Visibility control for the navigation item */
  visibility?: NavigationVisibility;
  /** Optional child navigation items for nested navigation */
  children?: NavigationItem[];
  /** Optional badge count or indicator */
  badge?: number | string;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
}

/**
 * Navigation group structure for organizing related items
 */
export interface NavigationGroup {
  /** Unique identifier for the group */
  id: string;
  /** Group label (optional, for section headers) */
  label?: string;
  /** Navigation items in this group */
  items: NavigationItem[];
}

/**
 * Navigation configuration structure
 */
export interface NavigationConfig {
  /** Navigation groups */
  groups: NavigationGroup[];
  /** Base path for application routes */
  basePath: string;
}

/**
 * Active route state for navigation highlighting
 */
export interface ActiveRouteState {
  /** The currently active path */
  path: string;
  /** Whether the current route is an exact match */
  isExact: boolean;
  /** The matched navigation item (if any) */
  activeItem?: NavigationItem;
}

/**
 * Breadcrumb item structure
 */
export interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** Path for the breadcrumb (undefined for current page) */
  path?: string;
  /** Whether this is the current page */
  isCurrent: boolean;
}
