/**
 * MobileSidebar component for PulseDesk application shell.
 * 
 * Provides mobile-only navigation behavior with:
 * - Open/close state management
 * - Overlay/backdrop
 * - Accessible close button
 * - Escape key support
 * - Focus handling
 * - Close after navigation
 * - Prevents confusing background interaction
 * 
 * Reuses the same navigation configuration as Sidebar for consistency.
 */

import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { navigationGroups } from '../../features/navigation/navigation';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { cn } from '../../utils/cn';

interface MobileSidebarProps {
  /** Whether the mobile sidebar is open */
  isOpen: boolean;
  /** Callback to close the sidebar */
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const location = useLocation();
  const { hasPermission } = useOrganizationContext();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

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

  // Handle Escape key to close sidebar
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus management: focus first element when opened
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  // Trap focus within sidebar when open
  useEffect(() => {
    if (!isOpen || !sidebarRef.current) return;

    const focusableElements = sidebarRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    function handleTab(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavigation = (disabled: boolean) => {
    if (disabled) return;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay/backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card border-r border-border shadow-lg md:hidden',
          'transform transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">P</span>
            </div>
            <span className="text-lg font-semibold text-foreground">
              PulseDesk
            </span>
          </div>
          <button
            ref={firstFocusableRef}
            type="button"
            onClick={onClose}
            className={cn(
              'p-2 rounded-md',
              'text-muted-foreground hover:bg-accent hover:text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
            )}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation content */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.id}>
              {group.label && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </h3>
              )}
              <ul className="space-y-1" role="list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <MobileSidebarNavLink
                      item={item}
                      currentPath={location.pathname}
                      onNavigate={() => handleNavigation(item.disabled || false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            PulseDesk v1.0.0
          </div>
        </div>
      </div>
    </>
  );
}

interface MobileSidebarNavLinkProps {
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
  onNavigate: () => void;
}

function MobileSidebarNavLink({ item, currentPath, onNavigate }: MobileSidebarNavLinkProps) {
  const Icon = item.icon;
  const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);

  return (
    <NavLink
      to={item.path}
      className={({ isActive: isLinkActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
          'border border-transparent',
          isLinkActive
            ? 'bg-accent text-foreground border-border'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
        )
      }
      aria-label={item.ariaLabel || item.label}
      aria-current={isActive ? 'page' : undefined}
      onClick={(e) => {
        if (item.disabled) {
          e.preventDefault();
        } else {
          onNavigate();
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
