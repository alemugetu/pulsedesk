/**
 * Breadcrumbs component for PulseDesk application shell.
 * 
 * Provides breadcrumb navigation that:
 * - Derives breadcrumb information from the current route
 * - Uses React Router conventions
 * - Provides accessible navigation semantics
 * - Shows clear hierarchy
 * - Is responsive
 * - Does not display meaningless technical route segments
 * 
 * Uses lucide-react icons for visual hierarchy.
 */

import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { findNavigationItemByPath } from '../../features/navigation/navigation';
import { cn } from '../../utils/cn';

interface BreadcrumbItem {
  label: string;
  path?: string;
  isCurrent: boolean;
}

export function Breadcrumbs() {
  const location = useLocation();
  const breadcrumbs = generateBreadcrumbs(location.pathname);

  // Don't show breadcrumbs on the home page
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      className="flex items-center space-x-1 text-sm text-muted-foreground"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" aria-hidden="true" />
            )}
            {breadcrumb.isCurrent ? (
              <span
                className="font-medium text-foreground"
                aria-current="page"
              >
                {breadcrumb.label}
              </span>
            ) : (
              <Link
                to={breadcrumb.path || '#'}
                className={cn(
                  'hover:text-foreground transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset rounded'
                )}
              >
                {breadcrumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Generate breadcrumbs from the current path
 * Uses navigation configuration to provide meaningful labels
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];

  // Add home breadcrumb
  breadcrumbs.push({
    label: 'Home',
    path: '/app',
    isCurrent: pathname === '/app',
  });

  // If we're on the home page, just return that
  if (pathname === '/app' || pathname === '/app/') {
    return breadcrumbs;
  }

  // Remove leading /app/ and split the path
  const pathSegments = pathname
    .replace(/^\/app\//, '')
    .split('/')
    .filter(Boolean);

  // Build up the path incrementally
  let currentPath = '/app';

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    currentPath += `/${segment}`;

    // Try to find a navigation item for this path
    const navItem = findNavigationItemByPath(currentPath);

    if (navItem) {
      breadcrumbs.push({
        label: navItem.label,
        path: currentPath,
        isCurrent: i === pathSegments.length - 1,
      });
    } else {
      // If no navigation item found, try to format the segment
      const formattedLabel = formatSegment(segment);
      if (formattedLabel) {
        breadcrumbs.push({
          label: formattedLabel,
          path: currentPath,
          isCurrent: i === pathSegments.length - 1,
        });
      }
    }
  }

  return breadcrumbs;
}

/**
 * Format a path segment into a readable label
 * Filters out technical segments and provides human-readable labels
 */
function formatSegment(segment: string): string | null {
  // Filter out technical segments
  const technicalSegments = ['id', 'uuid', 'edit', 'create', 'new'];
  if (technicalSegments.includes(segment.toLowerCase())) {
    return null;
  }

  // Convert kebab-case or snake_case to Title Case
  return segment
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
