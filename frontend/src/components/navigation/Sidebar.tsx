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
import { cn } from '../../utils/cn';

interface SidebarProps {
  /** Additional CSS classes */
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col w-64 border-r border-border bg-card',
        'h-[calc(100vh-4rem)]', // Subtract navbar height
        'overflow-y-auto',
        className
      )}
      aria-label="Main navigation"
    >
      <nav className="flex-1 px-3 py-4 space-y-6">
        {navigationGroups.map((group) => (
          <div key={group.id}>
            {group.label && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
            )}
            <ul className="space-y-1" role="list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarNavLink item={item} currentPath={location.pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer section for future use */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          PulseDesk v1.0.0
        </div>
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
}

function SidebarNavLink({ item, currentPath }: SidebarNavLinkProps) {
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
          // Active state styling - subtle background instead of hard border
          isLinkActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          // Disabled state
          item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
        )
      }
      aria-label={item.ariaLabel || item.label}
      aria-current={isActive ? 'page' : undefined}
      onClick={(e) => {
        if (item.disabled) {
          e.preventDefault();
        }
      }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
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
