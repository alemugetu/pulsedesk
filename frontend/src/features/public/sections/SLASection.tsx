/**
 * SLASection component - SLA management capabilities for landing page.
 * 
 * Explains SLA policies, tracking, and breach awareness.
 */

import { SLA_CONTENT } from '../content';

/**
 * SLASection component for landing page
 */
export function SLASection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {SLA_CONTENT.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {SLA_CONTENT.subtitle}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SLA_CONTENT.points.map((point, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
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
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {point.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
