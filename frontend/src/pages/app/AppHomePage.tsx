/**
 * AppHomePage component for PulseDesk application shell.
 * 
 * Clean authenticated landing/dashboard entry page.
 * 
 * Provides:
 * - Welcome/context for authenticated users
 * - Current authenticated application status
 * - Useful navigation entry points that actually exist
 * - Clean empty/foundation state for future workspace functionality
 * 
 * This is NOT the Operations Command Center (Phase 13.9).
 * Does not include fake incident metrics or operational data.
 */

import { useAuth } from '../../features/auth/hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { Home, LayoutDashboard, FileText, Settings, ArrowRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export function AppHomePage() {
  const { authState } = useAuth();
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
      title: 'Dashboard',
      description: 'View operational overview and metrics',
      icon: LayoutDashboard,
      disabled: true,
      comingSoon: true,
    },
    {
      title: 'Incidents',
      description: 'Manage and track incidents',
      icon: Home,
      disabled: true,
      comingSoon: true,
    },
    {
      title: 'Reports',
      description: 'Generate and view reports',
      icon: FileText,
      disabled: true,
      comingSoon: true,
    },
    {
      title: 'Settings',
      description: 'Configure application settings',
      icon: Settings,
      disabled: true,
      comingSoon: true,
    },
  ];

  return (
    <div className="space-y-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className={cn(
                  'p-6 transition-colors',
                  action.disabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:bg-accent cursor-pointer'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'p-3 rounded-lg',
                    action.disabled
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
                    {action.comingSoon && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Coming Soon
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Getting Started
            </h2>
            <p className="text-sm text-muted-foreground">
              PulseDesk is your incident and escalation operations system.
              Features are being rolled out in phases.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span>Phase 13.1-13.3: Foundation, Public Site, Authentication ✅</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Phase 13.4: Application Shell & Navigation (Current)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-muted" />
              <span>Phase 13.5+: Organizations, Incidents, Operations, and more</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

