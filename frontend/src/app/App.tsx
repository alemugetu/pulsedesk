/**
 * App component - Application root for PulseDesk.
 * 
 * Responsibilities:
 * - Application root
 * - Global application composition
 * - Root-level error boundary
 * 
 * Note: Routing is handled at the provider level in Phase 13.1
 * to ensure proper integration with the provider hierarchy.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface AppState {
  hasError: boolean;
  error?: Error;
}

interface AppProps {
  children: ReactNode;
}

/**
 * App component with error boundary for stable foundation.
 * Phase 13.1: Minimal implementation focused on foundation stability.
 */
export class App extends Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AppState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application error:', error, errorInfo);
    // In production, this would log to an error reporting service
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-2xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="mb-4 text-muted-foreground">
              The application encountered an unexpected error. Please refresh the page.
            </p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-4 text-xs">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
