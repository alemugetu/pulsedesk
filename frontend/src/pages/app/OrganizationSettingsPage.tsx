/**
 * Organization Settings Page.
 * 
 * Displays and manages organization settings with proper tenant isolation
 * and RBAC permission checks.
 * 
 * Backend permissions:
 * - View: settings.view
 * - Manage: settings.manage
 */

import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { useOrganizationSettings } from '../../features/organization-settings';
import { OrganizationSettingsForm } from '../../features/organization-settings';
import { Loading } from '../../components/ui/Loading';
import { ErrorState } from '../../components/ui/ErrorState';
import { Card, CardContent } from '../../components/ui/Card';

export function OrganizationSettingsPage() {
  const { currentOrganization, hasPermission } = useOrganizationContext();
  const {
    data: settings,
    isLoading,
    error,
    updateSettingsAsync,
    isUpdating,
    updateError,
    invalidateSettings,
  } = useOrganizationSettings();

  // Permission checks
  const canView = hasPermission('settings.view');
  const canManage = hasPermission('settings.manage');

  // Handle permission denied
  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You do not have permission to view organization settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading text="Loading settings..." />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ErrorState
          title="Failed to load settings"
          description="There was an error loading the organization settings. Please try again."
          onRetry={() => invalidateSettings()}
        />
      </div>
    );
  }

  // Handle no organization
  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please select an organization to view its settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle no settings data
  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No settings found for this organization.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle save
  const handleSave = async (data: Parameters<typeof updateSettingsAsync>[0]) => {
    await updateSettingsAsync(data);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Organization Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure operational settings for {currentOrganization.name}
        </p>
      </div>

      {/* Settings Form */}
      <OrganizationSettingsForm
        settings={settings}
        canManage={canManage}
        onSave={handleSave}
        isSaving={isUpdating}
        saveError={updateError}
      />
    </div>
  );
}
