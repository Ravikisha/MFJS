import React from 'react';
import { JORVEL_NAVIGATE_EVENT, type NavigateDetail } from './router.js';
import { usePathname } from './routing.js';

export type NavigationPhase = 'start' | 'complete';

export interface NavigationEvent {
  phase: NavigationPhase;
  from: string;
  to: string;
  state?: unknown;
}

export function useNavigationEvents(handler: (e: NavigationEvent) => void): void {
  const prevRef = React.useRef<string | null>(null);
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    prevRef.current = window.location.pathname;

    const onStart = (ev: Event) => {
      const ce = ev as CustomEvent<NavigateDetail>;
      handlerRef.current({
        phase: 'start',
        from: window.location.pathname,
        to: ce.detail?.to ?? '',
        state: ce.detail?.state,
      });
    };

    window.addEventListener(JORVEL_NAVIGATE_EVENT, onStart);
    return () => window.removeEventListener(JORVEL_NAVIGATE_EVENT, onStart);
  }, []);

  const pathname = usePathname();
  React.useEffect(() => {
    const prev = prevRef.current;
    if (prev !== null && prev !== pathname) {
      handlerRef.current({ phase: 'complete', from: prev, to: pathname });
    }
    prevRef.current = pathname;
  }, [pathname]);
}
