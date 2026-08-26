/**
 * OperationsSection component - Operations capabilities for landing page.
 * 
 * Explains how PulseDesk helps operations teams.
 */

import { OPERATIONS_CONTENT } from '../content';

/**
 * OperationsSection component for landing page
 */
export function OperationsSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {OPERATIONS_CONTENT.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {OPERATIONS_CONTENT.subtitle}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {OPERATIONS_CONTENT.points.map((point, index) => (
            <div key={index} className="relative pl-8">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-4 w-4 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">
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
