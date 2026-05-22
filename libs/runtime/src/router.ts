export type NavigateMode = 'push' | 'replace';

export type NavigateDetail = {
  /** Absolute path (pathname + optional search/hash). Example: "/dashboard/settings?tab=a#top" */
  to: string;
  mode?: NavigateMode;
  /** Optional state stored via history.pushState/replaceState */
  state?: any;
};

export const MOXJS_NAVIGATE_EVENT = 'moxjs:navigate';

function toUrlParts(to: string) {
  // new URL() needs an origin; we only care about path/search/hash.
  const u = new URL(to, 'http://moxjs.local');
  return { pathname: u.pathname, search: u.search, hash: u.hash };
}

function assertBrowser(api: string) {
  if (typeof window === 'undefined') {
    throw new Error(
      `${api} requires a browser environment (window). ` +
        `If you're calling this from SSR, create a server router instead.`
    );
  }
}

function currentPath() {
  assertBrowser('router.currentPath');
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function dispatchMoxjsNavigate(detail: NavigateDetail) {
  assertBrowser('dispatchMoxjsNavigate');
  window.dispatchEvent(new CustomEvent<NavigateDetail>(MOXJS_NAVIGATE_EVENT, { detail }));
}

export type Router = {
  /** Current path as pathname + search + hash */
  getPath(): string;
  /** Subscribe to location changes (popstate + internal navigate()) */
  subscribe(cb: (path: string) => void): () => void;
  /** Imperative navigation */
  navigate(detail: NavigateDetail): void;
  /** Destroy event listeners */
  destroy(): void;
};

export type RouterOptions = {
  /** When set, router only reacts to paths under this base ("/dashboard"). */
  basePath?: string;
  /** Listen for cross-app navigation events (default: true). */
  listenToNavigateEvents?: boolean;
};

export function createRouter(opts: RouterOptions = {}): Router {
  assertBrowser('createRouter');
  const { basePath = '', listenToNavigateEvents = true } = opts;

  const subs = new Set<(path: string) => void>();

  const matchesBase = (path: string) => {
    if (!basePath) return true;
    if (path === basePath) return true;
    return path.startsWith(basePath.endsWith('/') ? basePath : basePath + '/');
  };

  const emit = () => {
    const p = currentPath();
    if (!matchesBase(p)) return;
    for (const cb of subs) cb(p);
  };

  const apply = (detail: NavigateDetail) => {
    const { pathname, search, hash } = toUrlParts(detail.to);
    const next = `${pathname}${search}${hash}`;

    if (!matchesBase(next)) return;

    const mode: NavigateMode = detail.mode ?? 'push';
    if (mode === 'replace') window.history.replaceState(detail.state ?? null, '', next);
    else window.history.pushState(detail.state ?? null, '', next);

    emit();
  };

  const onPopState = () => emit();
  const onNavigateEvent = (e: Event) => {
    const ce = e as CustomEvent<NavigateDetail>;
    if (!ce.detail?.to) return;
    apply(ce.detail);
  };

  window.addEventListener('popstate', onPopState);
  if (listenToNavigateEvents) window.addEventListener(MOXJS_NAVIGATE_EVENT, onNavigateEvent);

  // Initial emit so subscribers can render right away.
  queueMicrotask(() => emit());

  return {
    getPath() {
      return currentPath();
    },
    subscribe(cb) {
      subs.add(cb);
      // Sync call with current value.
      cb(currentPath());
      return () => subs.delete(cb);
    },
    navigate(detail) {
      apply(detail);
    },
    destroy() {
      window.removeEventListener('popstate', onPopState);
      if (listenToNavigateEvents) window.removeEventListener(MOXJS_NAVIGATE_EVENT, onNavigateEvent);
      subs.clear();
    },
  };
}

/**
 * Convenience: attach a shell listener that converts moxjs:navigate events into history updates.
 *
 * Use this in the host if you want remotes to be able to navigate without importing the router.
 */
export function attachMoxjsNavigateListener() {
  assertBrowser('attachMoxjsNavigateListener');
  const onNavigateEvent = (e: Event) => {
    const ce = e as CustomEvent<NavigateDetail>;
    if (!ce.detail?.to) return;

    const { pathname, search, hash } = toUrlParts(ce.detail.to);
    const next = `${pathname}${search}${hash}`;

    const mode: NavigateMode = ce.detail.mode ?? 'push';
    if (mode === 'replace') window.history.replaceState(ce.detail.state ?? null, '', next);
    else window.history.pushState(ce.detail.state ?? null, '', next);

    // Mirror how createRouter notifies subscribers.
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  window.addEventListener(MOXJS_NAVIGATE_EVENT, onNavigateEvent);
  return () => window.removeEventListener(MOXJS_NAVIGATE_EVENT, onNavigateEvent);
}
