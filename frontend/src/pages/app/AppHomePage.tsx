/**
 * AppHomePage component for PulseDesk application shell.
 * 
 * Clean authenticated landing/dashboard entry page.
 * 
 * Provides:
 * - Welcome/context for authenticated users
 * - Current authenticated application status
 * - Permission-aware quick actions that adapt to user's role
 * - Working navigation entry points to real, implemented routes
 * - Clean foundation state for future workspace functionality
 *
 * Phase 13.15: Quick actions are now permission-gated — each action
 * specifies a requiredPermission and is hidden when the user lacks it.
 */

import { useAuth } from '../../features/auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useOrganizationContext } from '../../features/organizations/context/organizationContextDef';
import { OrganizationBrand } from '../../features/organizations/components/OrganizationBrand';
import { Card } from '../../components/ui/Card';
import {
  LayoutDashboard,
  Home,
  FileText,
  Settings,
  ArrowRight,
  AlertTriangle,
  Shield,
  KeyRound,
  FolderOpen,
  Users,
  UserPlus,
  ScrollText,
  Gauge,
  Siren,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  requiredPermission?: string;
}

export function AppHomePage() {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, currentOrganization } = useOrganizationContext();
  const user = authState.user;

  const getDisplayName = () => {
    if (user?.first_name) {
      return user.first_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const allQuickActions: QuickAction[] = [
    {
      title: 'Create Incident',
      description: 'Report a new operational incident',
      icon: AlertTriangle,
      to: '/app/incidents/new',
      requiredPermission: 'incident.create',
    },
    {
      title: 'Incidents',
      description: 'Manage and track incidents',
      icon: Home,
      to: '/app/incidents',
      requiredPermission: 'incident.view',
    },
    {
      title: 'Operations',
      description: 'Real-time operational command center',
      icon: Gauge,
      to: '/app/operations',
      requiredPermission: 'incident.view',
    },
    {
      title: 'Team Members',
      description: 'Manage team and member access',
      icon: Users,
      to: '/app/members',
      requiredPermission: 'member.view',
    },
    {
      title: 'Add Member',
      description: 'Invite or register a new team member',
      icon: UserPlus,
      to: '/app/members/new',
      requiredPermission: 'member.invite',
    },
    {
      title: 'SLA Policies',
      description: 'Configure service level agreements',
      icon: Siren,
      to: '/app/sla',
      requiredPermission: 'sla.view',
    },
    {
      title: 'Escalation Policies',
      description: 'Manage escalation rules and levels',
      icon: Shield,
      to: '/app/escalation',
      requiredPermission: 'escalation.view',
    },
    {
      title: 'Incident Categories',
      description: 'Manage incident classification',
      icon: FolderOpen,
      to: '/app/categories',
      requiredPermission: 'incident.view',
    },
    {
      title: 'Roles & Permissions',
      description: 'Manage roles and access',
      icon: KeyRound,
      to: '/app/roles',
      requiredPermission: 'role.view',
    },
    {
      title: 'Reports',
      description: 'Generate and view reports',
      icon: FileText,
      to: '/app/reports',
      requiredPermission: 'report.view',
    },
    {
      title: 'Audit Logs',
      description: 'Review organization audit trail',
      icon: ScrollText,
      to: '/app/audit',
      requiredPermission: 'audit_log.view',
    },
    {
      title: 'Settings',
      description: 'Configure organization settings',
      icon: Settings,
      to: '/app/settings',
      requiredPermission: 'settings.view',
    },
  ];

  // Filter quick actions based on user permissions
  const quickActions = allQuickActions.filter((action) => {
    if (!action.requiredPermission) return true;
    return hasPermission(action.requiredPermission);
  });

  return (
    <div className="space-y-6 bg-background min-h-full">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {getDisplayName()}
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
          {currentOrganization ? (
            <>
              <span>You're working in</span>
              <OrganizationBrand
                organizationId={currentOrganization.id}
                organizationName={currentOrganization.name}
                size="sm"
                nameClassName="font-medium text-foreground"
              />
            </>
          ) : (
            <span>You're authenticated and ready to use PulseDesk.</span>
          )}
        </div>
      </div>

      {/* Application Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Application Status
            </h2>
            <p className="text-sm text-muted-foreground">
              {user?.is_verified
                ? 'Your account is verified and active.'
                : 'Please verify your email address to access all features.'}
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
            user?.is_verified
              ? 'bg-green-500/10 text-green-500'
              : 'bg-yellow-500/10 text-yellow-500'
          )}>
            <div className={cn(
              'h-2 w-2 rounded-full',
              user?.is_verified ? 'bg-green-500' : 'bg-yellow-500'
            )} />
            {user?.is_verified ? 'Active' : 'Pending Verification'}
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Quick Actions
        </h2>
        {quickActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border bg-card/50">
            <LayoutDashboard className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              No quick actions available for your current role. Contact your organization administrator for access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className={cn(
                    'text-left rounded-xl p-6 transition-colors border border-border bg-card',
                    'hover:bg-accent hover:cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
                  )}
                  aria-label={`Navigate to ${action.title}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {action.description}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
