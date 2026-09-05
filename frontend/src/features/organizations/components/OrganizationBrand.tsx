/**
 * OrganizationBrand Component for PulseDesk.
 *
 * Displays the company logo to the left of the organization name.
 * Provides accessible fallback icon (Building2) if no logo is configured
 * or if the image fails to load.
 */

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useOrganizationBranding } from '../hooks/useOrganizationBranding';

interface OrganizationBrandProps {
  organizationName?: string;
  organizationId?: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  nameClassName?: string;
  className?: string;
}

export function OrganizationBrand({
  organizationName = 'Organization',
  organizationId,
  logoUrl: explicitLogoUrl,
  size = 'md',
  showName = true,
  nameClassName = '',
  className = '',
}: OrganizationBrandProps) {
  const { logoUrl: fetchedLogoUrl } = useOrganizationBranding(organizationId);
  const activeLogo = explicitLogoUrl !== undefined ? explicitLogoUrl : fetchedLogoUrl;

  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const hasImageError = Boolean(activeLogo && failedLogoUrl === activeLogo);

  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const renderLogo = () => {
    if (activeLogo && !hasImageError) {
      return (
        <div
          className={`shrink-0 overflow-hidden rounded border border-border bg-background flex items-center justify-center p-0.5 ${sizeClasses[size]}`}
        >
          <img
            src={activeLogo}
            alt={`${organizationName} logo`}
            onError={() => setFailedLogoUrl(activeLogo)}
            className="h-full w-full object-contain"
          />
        </div>
      );
    }

    return (
      <div
        className={`shrink-0 rounded bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/50 ${sizeClasses[size]}`}
        aria-hidden="true"
      >
        <Building2 className={iconSizeClasses[size]} />
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {renderLogo()}
      {showName && (
        <span
          className={`truncate font-medium text-foreground ${nameClassName}`}
          title={organizationName}
        >
          {organizationName}
        </span>
      )}
    </div>
  );
}
