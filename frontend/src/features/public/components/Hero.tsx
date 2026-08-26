/**
 * Hero component - Main hero section for PulseDesk landing page.
 * 
 * Communicates what PulseDesk is and provides primary CTAs.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { HERO_CONTENT } from '../content';

/**
 * Hero component for landing page
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {HERO_CONTENT.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            {HERO_CONTENT.subtitle}
          </p>
          <p className="mt-4 text-base text-muted-foreground">
            {HERO_CONTENT.description}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link to={HERO_CONTENT.primaryCta.path} className="gap-2">
                {HERO_CONTENT.primaryCta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={HERO_CONTENT.secondaryCta.path}>
                {HERO_CONTENT.secondaryCta.label}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
      </div>
    </section>
  );
}
