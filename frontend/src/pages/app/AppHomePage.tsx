/**
 * AppHomePage component for PulseDesk application shell.
 * 
 * Clean authenticated landing/dashboard entry page.
 * 
 * Provides:
 * - Welcome/context for authenticated users
 * - Current authenticated application status
 * - Working navigation entry points to real, implemented routes
 * - Clean foundation state for future workspace functionality
 * 
 * This is NOT the Operations Command Center (Phase 13.9).
 * Does not include fake incident metrics or operational data.
 */

import { useAuth } from '../../features/auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { LayoutDashboard, Home, FileText, Settings, ArrowRight, AlertTriangle, Shield, KeyRound, FolderOpen } from 'lucide-react';
import { cn } from '../../utils/cn';

export function AppHomePage() {
  const { authState } = useAuth();
  const navigate = useNavigate();
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

  const quickActions = [
    {
      title: 'Create Incident',
      description: 'Report a new operational incident',
      icon: AlertTriangle,
      to: '/app/incidents/new',
    },
    {
      title: 'Incidents',
      description: 'Manage and track incidents',
      icon: Home,
      to: '/app/incidents',
    },
    {
      title: 'SLA Policies',
      description: 'Configure service level agreements',
      icon: LayoutDashboard,
      to: '/app/sla',
    },
    {
      title: 'Escalation Policies',
      description: 'Manage escalation rules and levels',
      icon: Shield,
      to: '/app/escalation',
    },
    {
      title: 'Incident Categories',
      description: 'Manage incident classification',
      icon: FolderOpen,
      to: '/app/categories',
    },
    {
      title: 'Roles & Permissions',
      description: 'Manage roles and access',
      icon: KeyRound,
      to: '/app/roles',
    },
    {
      title: 'Reports',
      description: 'Generate and view reports',
      icon: FileText,
      to: '/app/reports',
    },
    {
      title: 'Settings',
      description: 'Configure organization settings',
      icon: Settings,
      to: '/app/settings',
    },
  ];

  return (
    <div className="space-y-6 bg-background min-h-full">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {getDisplayName()}
        </h1>
        <p className="text-muted-foreground">
          You're authenticated and ready to use PulseDesk.
        </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isDisabled = false;
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
                  <div className={cn(
                    'p-3 rounded-lg',
                    isDisabled
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary'
                  )}>
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
      </div>
    </div>
  );
}
