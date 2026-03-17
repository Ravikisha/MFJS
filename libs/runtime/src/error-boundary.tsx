import React from 'react';

export type ErrorBoundaryFallbackProps = {
  error: unknown;
  reset: () => void;
};

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  /**
   * Custom render function for fallback UI.
   * If omitted, a simple <pre> is rendered.
   */
  fallback?: (props: ErrorBoundaryFallbackProps) => React.ReactNode;
};

type ErrorBoundaryState = { error: unknown | null };

/**
 * A tiny Error Boundary for MFJS shells.
 *
 * Remote components can throw during render (or in lifecycle), and without an
 * error boundary React will unmount the whole tree.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
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
        <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }} data-testid="error-boundary">
          {message}
        </pre>
      );
    }

    return this.props.children;
  }
}
