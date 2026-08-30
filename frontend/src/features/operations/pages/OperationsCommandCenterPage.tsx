/**
 * OperationsCommandCenterPage component.
 *
 * The PulseDesk Operations Command Center — an authenticated, organization-
 * scoped operational dashboard backed entirely by the real backend Operations
 * Dashboard API (backend/apps/dashboard).
 *
 * Page flow:
 * - No organization selected -> guidance to select one (no API calls).
 * - Missing incident.view permission -> permission notice (no API calls).
 * - Otherwise -> operations sections (each driven by TanStack Query hooks).
 */

import { Building2, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  useCurrentOrganization,
  useOrganizationContext,
} from '../../organizations/context/organizationContextDef';
import { OperationsHeader } from '../components/OperationsHeader';
import { RealtimeConnectionStatus } from '../../realtime/components/RealtimeConnectionStatus';
import { OperationsSummary } from '../components/OperationsSummary';
import { IncidentStatusChart } from '../components/IncidentStatusChart';
import { IncidentPriorityChart } from '../components/IncidentPriorityChart';
import { ActiveIncidentsPanel } from '../components/ActiveIncidentsPanel';
import { CriticalIncidentsPanel } from '../components/CriticalIncidentsPanel';
import { RecentIncidentsPanel } from '../components/RecentIncidentsPanel';
import { SlaOverviewPanel } from '../components/SlaOverviewPanel';
import { EscalationOverviewPanel } from '../components/EscalationOverviewPanel';

export function OperationsCommandCenterPage() {
  const organization = useCurrentOrganization();
  const { hasPermission } = useOrganizationContext();

  if (!organization) {
    return (
      <div className="space-y-6">
        <OperationsHeader />
        <Card>
          <CardContent>
            <EmptyState
              title="Select an organization"
              description="Select an organization to view the Operations Command Center for its operational data."
              icon={<Building2 className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Frontend UX gate. The backend CanViewDashboard authorizes with
  // 'incident.view'. We avoid issuing dashboard requests when the user lacks
  // the permission (backend authorization remains authoritative).
  if (!hasPermission('incident.view')) {
    return (
      <div className="space-y-6">
        <OperationsHeader />
        <Card>
          <CardContent>
            <EmptyState
              title="Permission required"
              description="You need the incident view permission to access the Operations Command Center. Contact an organization administrator."
              icon={<ShieldAlert className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <OperationsHeader />

      <RealtimeConnectionStatus />

      <OperationsSummary />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <IncidentStatusChart />
        <IncidentPriorityChart />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ActiveIncidentsPanel />
        <CriticalIncidentsPanel />
        <RecentIncidentsPanel />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SlaOverviewPanel />
        <EscalationOverviewPanel />
      </div>
    </div>
  );
}