import React from 'react';
import { emitError } from './telemetry.js';

export type ErrorBoundaryFallbackProps = {
  error: unknown;
  reset: () => void;
};

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Custom render function for fallback UI. */
  fallback?: (props: ErrorBoundaryFallbackProps) => React.ReactNode;
  /** Optional callback invoked alongside `componentDidCatch`. */
  onError?: (error: unknown, info: React.ErrorInfo) => void;
  /**
   * Source label forwarded to telemetry. Default `'runtime'`. Set to
   * `'remote'` for `RemoteOutlet`-level boundaries so dashboards can split
   * remote crashes from host crashes.
   */
  source?: 'runtime' | 'remote';
};

type ErrorBoundaryState = { error: unknown | null };

/**
 * Error Boundary that emits `JORVEL_ERROR_EVENT` so observability adapters
 * (`@jorvel/observability`) can capture render-time crashes.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    try {
      emitError({
        error,
        source: this.props.source ?? 'runtime',
        context: { componentStack: info.componentStack },
      });
    } catch {
      // telemetry must never break the host
    }
    if (this.props.onError) {
      try {
        this.props.onError(error, info);
      } catch {
        // ignore
      }
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error != null) {
      const error = this.state.error;
      if (this.props.fallback) return this.props.fallback({ error, reset: this.reset });
      const message = error instanceof Error ? error.message : String(error);
      return (
        <div data-testid="error-boundary" style={{ padding: 12 }}>
          <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap', margin: 0 }}>{message}</pre>
          <button
            type="button"
            onClick={this.reset}
            style={{ marginTop: 8, padding: '4px 12px', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
