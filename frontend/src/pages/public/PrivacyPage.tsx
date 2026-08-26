/**
 * PrivacyPage component - Privacy policy page for PulseDesk.
 * 
 * Professional privacy policy structure with draft notice.
 */

import { useEffect } from 'react';
import { PRIVACY_CONTENT } from '../../features/public/content';
import { Card } from '../../components/ui/Card';

/**
 * PrivacyPage component
 */
export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — PulseDesk';
  }, []);

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {PRIVACY_CONTENT.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {PRIVACY_CONTENT.lastUpdated}
        </p>

        <Card className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Notice:</strong> {PRIVACY_CONTENT.notice}
          </p>
        </Card>

        <div className="mt-8 space-y-8">
          {PRIVACY_CONTENT.sections.map((section, index) => (
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
