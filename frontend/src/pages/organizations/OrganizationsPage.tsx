/**
 * OrganizationsPage for PulseDesk.
 * 
 * Main page for managing organizations with:
 * - Organization list display
 * - Create organization functionality
 * - Organization selection
 * - Loading and error states
 * - Integration with OrganizationContext
 * - Responsive design
 * - Accessibility features
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OrganizationList } from '../../features/organizations/components/OrganizationList';
import { CreateOrganizationForm } from '../../features/organizations/components/CreateOrganizationForm';
import { useOrganizationContext } from '../../features/organizations/context/OrganizationContext';
import type { Organization } from '../../features/organizations/types/organization';

type ViewMode = 'list' | 'create';

export function OrganizationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode: ViewMode = searchParams.get('create') === 'true' ? 'create' : 'list';
  const [viewMode, setViewModeRaw] = useState<ViewMode>(initialMode);

  const {
    organizations,
    isLoadingOrganizations,
    organizationsError,
    currentOrganization,
    selectOrganization,
  } = useOrganizationContext();

  const setViewMode = (mode: ViewMode) => {
    setViewModeRaw(mode);
    if (mode === 'create') {
      setSearchParams({ create: 'true' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleSelectOrganization = (organization: Organization) => {
    selectOrganization(organization);
  };

  const handleCreateSuccess = () => {
    setViewMode('list');
  };

  const handleCancelCreate = () => {
    setViewMode('list');
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
            <p className="text-sm text-muted-foreground">
              Manage your organizations and team settings
            </p>
          </div>
        </div>

        {viewMode === 'list' && (
          <Button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Organization
          </Button>
        )}
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <OrganizationList
          organizations={organizations}
          isLoading={isLoadingOrganizations}
          error={organizationsError}
          currentOrganizationId={currentOrganization?.id}
          onSelectOrganization={handleSelectOrganization}
        />
      ) : (
        <div className="max-w-2xl">
          <CreateOrganizationForm
            onSuccess={handleCreateSuccess}
            onCancel={handleCancelCreate}
          />
        </div>
      )}
    </div>
  );
}
