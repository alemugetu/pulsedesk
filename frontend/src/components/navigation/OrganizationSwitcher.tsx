/**
 * OrganizationSwitcher component for PulseDesk application shell.
 * 
 * Phase 13.4: Foundation implementation only.
 * 
 * This component establishes the correct shell location/interface for the
 * organization switcher. Actual organization functionality (CRUD, members,
 * roles, RBAC) will be implemented in Phase 13.5.
 * 
 * Current implementation provides:
 * - Typed placeholder state for organization data
 * - Correct shell location in the application navbar
 * - UI structure ready for Phase 13.5 integration
 * - Loading and error states for future API integration
 */

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

/**
 * Placeholder organization type for Phase 13.4
 * Phase 13.5 will replace this with the actual organization type from the API
 */
interface PlaceholderOrganization {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Placeholder state for organization switcher
 * Phase 13.5 will integrate with actual organization state management
 */
export function OrganizationSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Placeholder organization data
  // Phase 13.5 will replace this with actual organization data from the API
  const [currentOrganization] = useState<PlaceholderOrganization>({
    id: 'placeholder',
    name: 'Select Organization',
  });

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleCreateOrganization = () => {
    setIsOpen(false);
    // Placeholder for Phase 13.5 organization creation
    console.log('Create organization - Phase 13.5');
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2 px-2"
        disabled
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="hidden md:inline text-sm font-medium">
            {currentOrganization.name}
          </span>
          <ChevronDown className="h-4 w-4 hidden md:block text-muted-foreground" />
        </div>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute left-0 top-full mt-2 w-72 rounded-md border border-border bg-card shadow-lg',
            'animate-in fade-in slide-in-from-top-1',
            'z-50'
          )}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="org-switcher-button"
        >
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Organizations
            </p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {/* Placeholder for organization list */}
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Organization management</p>
              <p className="text-xs mt-1">Coming in Phase 13.5</p>
            </div>
          </div>

          <div className="border-t border-border p-2">
            <button
              onClick={handleCreateOrganization}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
                'rounded-md'
              )}
              role="menuitem"
              disabled
            >
              <Plus className="h-4 w-4" />
              Create Organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
