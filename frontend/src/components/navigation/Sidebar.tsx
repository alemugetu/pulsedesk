/**
 * Sidebar component for PulseDesk application shell.
 * 
 * Provides scalable navigation structure for the authenticated application.
 * Consumes the centralized navigation configuration from navigation.ts.
 * 
 * Features:
 * - Active route indication with subtle styling
 * - Accessible navigation with keyboard support
 * - Icons from lucide-react
 * - Tooltip support
 * - Desktop layout
 * - Extensible for future phases (Organizations, Incidents, Operations, Reports, Settings, Audit)
 */

import { NavLink, useLocation } from 'react-router-dom';
import { navigationGroups } from '../../features/navigation/navigation';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { cn } from '../../utils/cn';

interface SidebarProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the compact icon-only desktop navigation */
  isCollapsed?: boolean;
}

export function Sidebar({ className, isCollapsed = false }: SidebarProps) {
  const location = useLocation();
  const { hasPermission } = useOrganizationContext();

  // Filter navigation items by permission
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.requiredPermission) return true;
        return hasPermission(item.requiredPermission);
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        'hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-card md:flex',
        'transition-[width] duration-200 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
      id="desktop-sidebar"
      aria-label="Main navigation"
    >
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {visibleGroups.map((group) => (
          <div key={group.id}>
            {group.label && (
              <h3
                className={cn(
                  'px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                  isCollapsed && 'sr-only'
                )}
              >
                {group.label}
              </h3>
            )}
            <ul className="space-y-1" role="list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarNavLink
                    item={item}
                    currentPath={location.pathname}
                    isCollapsed={isCollapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer section for future use */}
      <div className={cn('border-t border-border', isCollapsed ? 'p-2 text-center' : 'p-4')}>
        <div className={cn('text-xs text-muted-foreground', isCollapsed && 'sr-only')}>
          PulseDesk v1.0.0
        </div>
        {isCollapsed && <span className="text-xs font-semibold text-muted-foreground" aria-hidden="true">P</span>}
      </div>
    </aside>
  );
}

interface SidebarNavLinkProps {
  item: {
    id: string;
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
    badge?: number | string;
    ariaLabel?: string;
  };
  currentPath: string;
  isCollapsed: boolean;
}

function SidebarNavLink({ item, currentPath, isCollapsed }: SidebarNavLinkProps) {
  const Icon = item.icon;
  const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);

  return (
    <NavLink
      to={item.path}
      className={({ isActive: isLinkActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
          'relative',
          isCollapsed && 'justify-center px-2',
          // Active state styling - subtle background instead of hard border
          isLinkActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          // Disabled state
          item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
        )
      }
      aria-label={item.ariaLabel || item.label}
      title={isCollapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      onClick={(e) => {
        if (item.disabled) {
          e.preventDefault();
        }
      }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className={cn('flex-1', isCollapsed && 'sr-only')}>{item.label}</span>
      {item.badge && !isCollapsed && (
        <span
          className={cn(
            'inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
          aria-label={`${item.badge} items`}
        >
          {item.badge}
        </span>
      )}
      {item.disabled && (
        <span className="sr-only">(Coming Soon)</span>
      )}
    </NavLink>
  );
}
