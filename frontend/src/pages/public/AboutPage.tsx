/**
 * AboutPage component - About page for PulseDesk.
 * 
 * Explains PulseDesk's purpose and philosophy.
 */

import { useEffect } from 'react';
import { ABOUT_CONTENT } from '../../features/public/content';

/**
 * AboutPage component
 */
export function AboutPage() {
  useEffect(() => {
    document.title = 'About — PulseDesk';
  }, []);

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {ABOUT_CONTENT.title}
        </h1>

        <div className="mt-12 space-y-12">
          {ABOUT_CONTENT.sections.map((section, index) => (
            <section key={index}>
              <h2 className="text-2xl font-semibold text-foreground">
                {section.heading}
              </h2>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
