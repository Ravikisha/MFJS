import React from 'react';

export type IslandStrategy = 'load' | 'idle' | 'visible' | 'media' | 'interaction';

export interface IslandProps {
  /** Lazy component loader — keeps the client JS out of static-only pages. */
  load: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
  /** Pick when to hydrate. Default: 'load'. */
  strategy?: IslandStrategy;
  /** Used with strategy='media' — CSS media query. */
  media?: string;
  /** Used with strategy='visible' — IntersectionObserver options. */
  visibleOptions?: IntersectionObserverInit;
  /** Used with strategy='interaction' — DOM events that trigger hydration. */
  interactionEvents?: Array<keyof HTMLElementEventMap>;
  /** Fallback rendered on server / before hydration. Typically the SSR HTML. */
  fallback?: React.ReactNode;
  /** Props forwarded to the loaded component. */
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Delay client-side hydration until the chosen strategy fires. The `fallback`
 * is what the server rendered; the real component mounts later.
 */
export function Island({
  load,
  strategy = 'load',
  media,
  visibleOptions,
  interactionEvents,
  fallback,
  children,
  ...rest
}: IslandProps) {
  const [Component, setComponent] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const hydrate = () => {
      if (cancelled) return;
      load().then((m) => {
        if (!cancelled) setComponent(() => m.default);
      });
    };

    const cleanups: Array<() => void> = [];
    switch (strategy) {
      case 'load':
        hydrate();
        break;
      case 'idle':
        if ('requestIdleCallback' in window) {
          const id = (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(hydrate);
          cleanups.push(() => (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id));
        } else {
          const timer = setTimeout(hydrate, 1);
          cleanups.push(() => clearTimeout(timer));
        }
        break;
      case 'visible': {
        if (!ref.current || !('IntersectionObserver' in window)) {
          hydrate();
          break;
        }
        const observer = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect();
            hydrate();
          }
        }, visibleOptions);
        observer.observe(ref.current);
        cleanups.push(() => observer.disconnect());
        break;
      }
      case 'media': {
        if (!media || typeof window.matchMedia !== 'function') {
          hydrate();
          break;
        }
        const mq = window.matchMedia(media);
        if (mq.matches) hydrate();
        else {
          const handler = (e: MediaQueryListEvent) => e.matches && hydrate();
          mq.addEventListener('change', handler);
          cleanups.push(() => mq.removeEventListener('change', handler));
        }
        break;
      }
      case 'interaction': {
        const events = interactionEvents ?? ['click', 'focus', 'pointerover', 'touchstart'];
        const node = ref.current;
        if (!node) {
          hydrate();
          break;
        }
        const handler = () => {
          events.forEach((e) => node.removeEventListener(e, handler));
          hydrate();
        };
        events.forEach((e) => node.addEventListener(e, handler, { once: true, passive: true }));
        cleanups.push(() => events.forEach((e) => node.removeEventListener(e, handler)));
        break;
      }
    }
    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [strategy, media, visibleOptions, interactionEvents, load]);

  return (
    <div ref={ref} data-jorvel-island={strategy}>
      {Component ? <Component {...rest}>{children}</Component> : (fallback ?? children ?? null)}
    </div>
  );
}

/** Marker for build-time scanning — indicates a component boundary should hydrate. */
export function clientBoundary<T extends React.ComponentType<Record<string, unknown>>>(Component: T): T {
  (Component as unknown as { __jorvelClient?: true }).__jorvelClient = true;
  return Component;
}
