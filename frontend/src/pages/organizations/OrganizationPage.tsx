/**
 * OrganizationPage for PulseDesk.
 * 
 * Detail page for a single organization with:
 * - Organization information display
 * - Members tab
 * - Roles tab
 * - Loading and error states
 * - Integration with OrganizationContext
 * - Responsive design
 * - Accessibility features
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Users, Shield, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OrganizationMembers } from '../../features/organizations/components/OrganizationMembers';
import { OrganizationRoles } from '../../features/organizations/components/OrganizationRoles';
import { useOrganization } from '../../features/organizations/hooks/useOrganization';
import { cn } from '../../utils/cn';

type TabType = 'overview' | 'members' | 'roles';

export function OrganizationPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const {
    data: organization,
    isLoading,
    error,
  } = useOrganization(organizationId || '');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-sm text-destructive font-medium">
          {error?.message || 'Organization not found'}
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: Building2 },
    { id: 'members' as TabType, label: 'Members', icon: Users },
    { id: 'roles' as TabType, label: 'Roles', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{organization.name}</h1>
            <p className="text-sm text-muted-foreground">
              {organization.slug} • {organization.status}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8" aria-label="Organization tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Organization info */}
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Organization Details
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                    <dd className="text-sm text-foreground">{organization.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
                    <dd className="text-sm text-foreground">{organization.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                    <dd className="text-sm text-foreground">{organization.status}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                    <dd className="text-sm text-foreground">
                      {new Date(organization.created_at).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                    <dd className="text-sm text-foreground">
                      {new Date(organization.updated_at).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Quick stats placeholder */}
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Quick Stats
                </h3>
                <p className="text-sm text-muted-foreground">
                  Organization statistics will be available in future phases.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <OrganizationMembers organizationId={organization.id} />
        )}

        {activeTab === 'roles' && (
          <OrganizationRoles organizationId={organization.id} />
        )}
      </div>
    </div>
  );
}
