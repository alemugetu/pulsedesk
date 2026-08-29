/**
 * OrganizationSwitcher component for PulseDesk application shell.
 * 
 * Phase 13.5: Full integration with OrganizationContext.
 * 
 * This component provides:
 * - Real organization data from OrganizationContext
 * - Organization switching with tenant isolation
 * - Loading and error states
 * - Create organization functionality
 * - Keyboard navigation and accessibility
 * - Responsive design
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import type { Organization } from '../../features/organizations/types/organization';

export function OrganizationSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const {
    organizations,
    currentOrganization,
    isLoadingOrganizations,
    organizationsError,
    selectOrganization,
    hasOrganizations,
  } = useOrganizationContext();

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

  const handleSelectOrganization = (org: Organization) => {
    selectOrganization(org);
    setIsOpen(false);
  };

  const handleCreateOrganization = async () => {
    setIsOpen(false);
    navigate('/app/organizations?create=true');
  };

  const displayText = currentOrganization?.name || 'Select Organization';
  const isDisabled = isLoadingOrganizations || !hasOrganizations;

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
        disabled={isDisabled}
      >
        <div className="flex items-center gap-2">
          {isLoadingOrganizations ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="hidden md:inline text-sm font-medium">
            {displayText}
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
            {isLoadingOrganizations ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                <p>Loading organizations...</p>
              </div>
            ) : organizationsError ? (
              <div className="px-3 py-4 text-center text-sm text-destructive">
                <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                <p>Error loading organizations</p>
                <p className="text-xs mt-1">{organizationsError}</p>
              </div>
            ) : organizations.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No organizations yet</p>
                <p className="text-xs mt-1">Create your first organization to get started</p>
              </div>
            ) : (
              <ul role="menu" className="py-1">
                {organizations.map((org) => (
                  <li key={org.id}>
                    <button
                      onClick={() => handleSelectOrganization(org)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
                        'transition-colors',
                        currentOrganization?.id === org.id && 'bg-accent'
                      )}
                      role="menuitem"
                      aria-current={currentOrganization?.id === org.id ? 'true' : undefined}
                    >
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{org.name}</span>
                      {currentOrganization?.id === org.id && (
                        <span className="text-xs text-muted-foreground">Current</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <button
              onClick={handleCreateOrganization}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
                'rounded-md transition-colors'
              )}
              role="menuitem"
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
