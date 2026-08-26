/**
 * SecuritySection component - Security capabilities for landing page.
 * 
 * Explains multi-tenancy, RBAC, and access control.
 */

import { SECURITY_CONTENT } from '../content';

/**
 * SecuritySection component for landing page
 */
export function SecuritySection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {SECURITY_CONTENT.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {SECURITY_CONTENT.subtitle}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECURITY_CONTENT.points.map((point, index) => (
            <div
              key={index}
              className="flex gap-4 rounded-lg border border-border bg-card p-6"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <svg
                  className="h-5 w-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {point.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
