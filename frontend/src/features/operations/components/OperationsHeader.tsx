/**
 * OperationsHeader component.
 *
 * Provides the Operational Command Center heading and organization context.
 * The organization switcher lives in the application shell (AppLayout) and is
 * intentionally NOT duplicated here.
 */

import { Radar } from 'lucide-react';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';

export function OperationsHeader() {
  const organization = useCurrentOrganization();

  return (
    <header className="space-y-2" aria-labelledby="operations-command-center-heading">
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Radar className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1
            id="operations-command-center-heading"
            className="text-2xl font-bold text-foreground"
          >
            Operations Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            {organization
              ? `Operational overview for ${organization.name}`
              : 'Operational overview for the current organization'}
          </p>
        </div>
      </div>
    </header>
  );
}