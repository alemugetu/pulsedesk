/**
 * FeaturesSection component - Features overview for landing page.
 * 
 * Presents core platform capabilities at a high level.
 */

import { Card } from '../../../components/ui/Card';
import { FEATURES_CONTENT } from '../content';

/**
 * FeaturesSection component for landing page
 */
export function FeaturesSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {FEATURES_CONTENT.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {FEATURES_CONTENT.subtitle}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES_CONTENT.features.map((feature, index) => (
            <Card key={index} className="p-6">
              <h3 className="text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
