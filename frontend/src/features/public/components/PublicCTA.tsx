/**
 * PublicCTA component - Reusable call-to-action for PulseDesk public pages.
 * 
 * Provides a flexible CTA component with primary and secondary actions.
 */

import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';

interface PublicCTAProps {
  title: string;
  subtitle?: string;
  primaryCta?: {
    label: string;
    path: string;
  };
  secondaryCta?: {
    label: string;
    path: string;
  };
  className?: string;
}

/**
 * PublicCTA component for call-to-action sections
 */
export function PublicCTA({ title, subtitle, primaryCta, secondaryCta, className }: PublicCTAProps) {
  return (
    <section className={cn('py-16 px-4 sm:px-6 lg:px-8', className)}>
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-4 text-lg text-muted-foreground">
            {subtitle}
          </p>
        )}
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {primaryCta && (
              <Button asChild size="lg">
                <Link to={primaryCta.path}>{primaryCta.label}</Link>
              </Button>
            )}
            {secondaryCta && (
              <Button asChild variant="outline" size="lg">
                <Link to={secondaryCta.path}>{secondaryCta.label}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
