import React from 'react';
import {
  ErrorBoundary,
  type ErrorBoundaryFallbackProps,
  type ErrorBoundaryProps,
} from './error-boundary.js';

export type WithErrorBoundaryOptions = {
  /** Optional custom fallback renderer. */
  fallback?: ErrorBoundaryProps['fallback'];

  /**
   * Optional custom test id for the default fallback.
   * If you provide a custom `fallback`, this is ignored.
   */
  testId?: string;
};

/**
 * Wrap any component with an ErrorBoundary.
 *
 * Useful when you render a remote component outside of `RemoteOutlet`.
 */
export function withErrorBoundary<P>(
  Component: React.ComponentType<P>,
  options?: WithErrorBoundaryOptions
): React.ComponentType<P> {
  const Wrapped: React.FC<any> = (props: P) => {
    const fallback: ErrorBoundaryProps['fallback'] =
      options?.fallback ??
      (({ error }: ErrorBoundaryFallbackProps) => {
        const message = error instanceof Error ? error.message : String(error);
        return (
          <pre
            style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}
            data-testid={options?.testId ?? 'error-boundary'}
          >
            {message}
          </pre>
        );
      });

    return (
      <ErrorBoundary fallback={fallback}>
  <Component {...(props as any)} />
      </ErrorBoundary>
    );
  };

  Wrapped.displayName = `withErrorBoundary(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
}

/**
 * Wrap a lazy import with an ErrorBoundary.
 *
 * ```ts
 * const Remote = wrapLazyWithErrorBoundary(() => import('dashboard/App'))
 * ```
 */
export function wrapLazyWithErrorBoundary<P>(
  loader: () => Promise<{ default: React.ComponentType<P> }>,
  options?: WithErrorBoundaryOptions
): React.LazyExoticComponent<React.ComponentType<P>> {
  return React.lazy(async () => {
    const mod = await loader();
    return { default: withErrorBoundary(mod.default, options) };
  });
}
