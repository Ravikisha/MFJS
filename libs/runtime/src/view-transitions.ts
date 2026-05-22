import { dispatchMoxjsNavigate, type NavigateDetail } from './router.js';

interface StartViewTransition {
  (cb: () => void | Promise<void>): ViewTransitionHandle;
}

interface ViewTransitionHandle {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
}

interface DocumentWithVT {
  startViewTransition?: StartViewTransition;
}

export interface ViewTransitionOptions {
  /** Skip the transition when reduced motion is requested. Default: true. */
  respectReducedMotion?: boolean;
}

export function supportsViewTransitions(): boolean {
  if (typeof document === 'undefined') return false;
  return typeof (document as DocumentWithVT).startViewTransition === 'function';
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Wrap a state change in a View Transition. Fallbacks when unsupported or when
 * the user prefers reduced motion.
 */
export function withViewTransition(
  update: () => void | Promise<void>,
  opts: ViewTransitionOptions = {},
): Promise<void> {
  const respectReduced = opts.respectReducedMotion !== false;
  if (!supportsViewTransitions() || (respectReduced && prefersReducedMotion())) {
    return Promise.resolve(update()).then(() => undefined);
  }
  const doc = document as DocumentWithVT;
  const handle = doc.startViewTransition!(() => update());
  return handle.finished.catch(() => undefined);
}

/**
 * Navigate inside a View Transition so the browser animates between DOM
 * snapshots. Drop-in replacement for `dispatchMoxjsNavigate`.
 */
export function navigateWithTransition(detail: NavigateDetail, opts?: ViewTransitionOptions): Promise<void> {
  return withViewTransition(() => dispatchMoxjsNavigate(detail), opts);
}
