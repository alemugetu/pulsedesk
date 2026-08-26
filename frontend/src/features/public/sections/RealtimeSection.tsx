/**
 * RealtimeSection component - Real-time operations for landing page.
 * 
 * Explains live operational updates and WebSocket-powered features.
 */

import { REALTIME_CONTENT } from '../content';

/**
 * RealtimeSection component for landing page
 */
export function RealtimeSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {REALTIME_CONTENT.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {REALTIME_CONTENT.subtitle}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {REALTIME_CONTENT.points.map((point, index) => (
            <div key={index} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
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
