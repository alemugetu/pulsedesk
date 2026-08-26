/**
 * FeaturesPage component - Features page for PulseDesk.
 * 
 * Detailed overview of platform capabilities.
 */

import { useEffect } from 'react';
import { FEATURES_CONTENT } from '../../features/public/content';
import { Card } from '../../components/ui/Card';

/**
 * FeaturesPage component
 */
export function FeaturesPage() {
  useEffect(() => {
    document.title = 'Features — PulseDesk';
  }, []);

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {FEATURES_CONTENT.title}
          </h1>
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
    </div>
  );
}
