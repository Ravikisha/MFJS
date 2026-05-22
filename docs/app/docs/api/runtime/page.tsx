import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@moxjs/runtime API',
  description:
    'Full surface area of @moxjs/runtime — router, remote loader, hooks, guards, telemetry, View Transitions, islands, Service Worker, Shadow DOM.',
};

export default function RuntimeApi() {
  return (
    <>
      <h1>@moxjs/runtime</h1>
      <p>
        Singleton-safe router, remote loader, hooks, guards, telemetry. Every export below is
        importable from <code>@moxjs/runtime</code>; the package is configured as a Module
        Federation singleton so host and remote observe the same router instance.
      </p>

      <Callout variant="info" title="Type-safety">
        Every function below is fully typed. Pass generics where shown to thread types from your
        own route registry through to hooks.
      </Callout>

      <h2 id="router">Router</h2>
      <table>
        <thead><tr><th>Symbol</th><th>Signature</th></tr></thead>
        <tbody>
          <tr><td><code>getRouter</code></td><td><code>(opts?: RouterOptions) =&gt; Router</code> — returns the singleton, creating it on first call</td></tr>
          <tr><td><code>createRouter</code></td><td><code>(opts?: RouterOptions) =&gt; Router</code> — fresh instance, for tests</td></tr>
          <tr><td><code>useRouter</code></td><td><code>() =&gt; Router</code> — hook</td></tr>
          <tr><td><code>usePathname</code></td><td><code>() =&gt; string</code> — pathname + search + hash</td></tr>
          <tr><td><code>dispatchMoxjsNavigate</code></td><td><code>(detail: NavigateDetail) =&gt; void</code></td></tr>
          <tr><td><code>attachMoxjsNavigateListener</code></td><td><code>() =&gt; () =&gt; void</code> — returns disposer</td></tr>
        </tbody>
      </table>
      <CodeBlock
        language="ts"
        code={`type NavigateDetail = {
  to: string;                     // pathname + optional ?search and #hash
  mode?: 'push' | 'replace';      // default 'push'
  state?: unknown;                // stored via history.{push,replace}State
};

type RouterOptions = {
  basePath?: string;              // ignore paths outside this prefix
  listenToNavigateEvents?: boolean; // default true
};`}
      />

      <h2 id="components">Routing components</h2>
      <table>
        <thead><tr><th>Component</th><th>Props</th></tr></thead>
        <tbody>
          <tr><td><code>&lt;NavLink&gt;</code></td><td><code>to</code>, <code>label</code>, <code>prefetch?</code>, <code>activeStyle?</code>, <code>className?</code>, <code>activeClassName?</code></td></tr>
          <tr><td><code>&lt;NavLinkPrefetchProvider&gt;</code></td><td><code>config: {'{ routes, remotes }'}</code></td></tr>
          <tr><td><code>&lt;RemoteOutlet&gt;</code></td><td><code>routes</code>, <code>remotes</code>, <code>fallback?</code>, <code>noMatch?</code>, <code>errorBoundary?</code></td></tr>
          <tr><td><code>&lt;RemoteApp&gt;</code></td><td><code>subpath</code>, <code>pages</code>, <code>fallback?</code>, <code>noMatch?</code></td></tr>
          <tr><td><code>&lt;ErrorBoundary&gt;</code></td><td><code>fallback: (err, reset) =&gt; ReactNode</code>, <code>onError?: (err) =&gt; void</code></td></tr>
        </tbody>
      </table>

      <h2 id="nested">Nested routes</h2>
      <ul>
        <li><code>&lt;NestedRouter routes fallback? notFound? /&gt;</code></li>
        <li><code>&lt;Outlet /&gt;</code> — child slot</li>
        <li><code>useOutletParams&lt;T&gt;(): T</code></li>
        <li><code>resolveChain(routes, pathname): NestedMatch[]</code> — pure resolver, no React</li>
      </ul>

      <h2 id="typed">Typed routes</h2>
      <CodeBlock
        language="ts"
        code={`type Validator<T> = { parse(input: unknown): T; safeParse?(input: unknown): { success: true; data: T } | { success: false; error: unknown } };

createRoute<TParams, TSearch>({
  path: string;                   // '/users/:id'
  params?: Validator<TParams>;
  search?: Validator<TSearch>;
}): TypedRoute<TParams, TSearch>;

defineRoutes<T extends Record<string, TypedRoute<any, any>>>(map: T): T;`}
      />

      <h2 id="hooks">Hooks</h2>
      <table>
        <thead><tr><th>Hook</th><th>Signature</th></tr></thead>
        <tbody>
          <tr><td><code>useSearchParams</code></td><td><code>() =&gt; [URLSearchParams, (next, mode?: &apos;push&apos; | &apos;replace&apos;) =&gt; void]</code></td></tr>
          <tr><td><code>useQueryParam</code></td><td><code>(key: string) =&gt; [string | null, (next: string | null) =&gt; void]</code></td></tr>
          <tr><td><code>useParams</code></td><td><code>&lt;T&gt;() =&gt; T</code> — from the nearest <code>ParamsProvider</code></td></tr>
          <tr><td><code>useNavigate</code></td><td><code>() =&gt; (to: string, opts?: {'{ replace?, state? }'}) =&gt; void</code></td></tr>
          <tr><td><code>useNavigationEvents</code></td><td><code>(handler: (e: NavigationEvent) =&gt; void) =&gt; void</code></td></tr>
          <tr><td><code>useRemoteData</code></td><td><code>{'<T>({ key, fetcher, ttl? }) => { data, error, loading, refresh }'}</code></td></tr>
        </tbody>
      </table>

      <h2 id="guards">Guards</h2>
      <CodeBlock
        language="ts"
        code={`type GuardResult = boolean | { redirect: string };
type RouteGuard = (ctx: { pathname: string; params: Record<string, string> }) => GuardResult | Promise<GuardResult>;

runGuards(resolved, pathname, globalGuards?: RouteGuard[]): Promise<GuardResult>;

createAuthGuard({
  isAuthenticated: () => boolean | Promise<boolean>;
  loginPath?: string;             // default '/login'
  captureReturnTo?: boolean;      // default true — appends ?next=…
}): RouteGuard;

createRoleGuard({
  hasRole: (role: string) => boolean;
  roles: string[];                // any-of
  fallbackPath?: string;
}): RouteGuard;`}
      />

      <h2 id="view-transitions">View Transitions</h2>
      <ul>
        <li><code>navigateWithTransition(detail, opts?: {'{ respectReducedMotion? }'})</code></li>
        <li><code>withViewTransition(update: () =&gt; void | Promise&lt;void&gt;, opts?)</code></li>
        <li><code>supportsViewTransitions(): boolean</code></li>
        <li><code>prefersReducedMotion(): boolean</code></li>
      </ul>

      <h2 id="prefetch">Prefetch</h2>
      <ul>
        <li><code>prefetchRoute(pathname: string, config: {'{ routes, remotes }'}): Promise&lt;void&gt;</code></li>
        <li><code>resetPrefetchCache(): void</code></li>
      </ul>

      <h2 id="preload">Concurrent preload</h2>
      <CodeBlock
        language="ts"
        code={`preloadRemotes(
  remotes: Array<{ name: string; entryUrl: string; integrity?: string }>,
  opts?: {
    concurrency?: number;   // default 3
    idle?: boolean;         // default true — wraps each load in requestIdleCallback
    idleBudgetMs?: number;  // default 8
    onResult?: (r: { remote: string; ok: boolean; durationMs: number; error?: unknown }) => void;
  },
): Promise<void>;`}
      />

      <h2 id="sw">Service Worker</h2>
      <CodeBlock
        language="ts"
        code={`registerMoxjsServiceWorker(opts?: {
  url?: string;                   // default '/moxjs-sw.js'
  scope?: string;                 // default '/'
  autoActivate?: boolean;         // post SKIP_WAITING on update
  onUpdateReady?: () => void;
  onActivated?: () => void;
}): Promise<ServiceWorkerRegistration | null>;

unregisterMoxjsServiceWorker(): Promise<boolean>;

// Inline source — useful for build-time injection
declare const MOXJS_SERVICE_WORKER_SOURCE: string;`}
      />

      <h2 id="shadow">Shadow DOM</h2>
      <CodeBlock
        language="ts"
        code={`<ShadowRemote
  mode?: 'open' | 'closed';       // default 'open'
  css?: string;                   // inlined into <style>
  stylesheets?: string[];         // resolved as <link rel="stylesheet">
>{children}</ShadowRemote>

scopeCss(css: string, scopePrefix: string): string;`}
      />

      <h2 id="islands">Islands</h2>
      <CodeBlock
        language="ts"
        code={`<Island
  strategy?: 'load' | 'idle' | 'visible' | 'media' | 'interaction';
  media?: string;                 // required when strategy === 'media'
  load: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ReactNode;
  rootMargin?: string;            // IntersectionObserver fine-tuning
/>

clientBoundary<T>(component: T): T;     // marker for future tooling`}
      />

      <h2 id="loader">Remote loader</h2>
      <CodeBlock
        language="ts"
        code={`loadRemoteEntry({
  name: string;
  entryUrl: string;
  integrity?: string;             // SRI hash
  allowedOrigins?: string[];      // verified before fetch
}): Promise<void>;

loadRemoteModule<T = unknown>(
  name: string,
  exposedKey: string,             // './App'
  opts?: { allowedOrigins?: string[]; integrity?: string },
): Promise<T>;

initRemoteContainer(name: string): Promise<void>;`}
      />

      <h2 id="registry">Remote registry</h2>
      <CodeBlock
        language="ts"
        code={`getRemoteRegistry(opts?: {
  allowedOrigins?: string[];
  fetcher?: typeof fetch;
}): RemoteRegistry;

class RemoteRegistry {
  register(d: RemoteDescriptor): void;
  unregister(name: string): void;
  get(name: string): RemoteDescriptor | undefined;
  list(): RemoteDescriptor[];
  load(manifestUrl: string): Promise<void>;
}`}
      />

      <h2 id="version">Version check</h2>
      <CodeBlock
        language="ts"
        code={`checkVersions({
  host: { name: string; version: string };
  remote: { name: string; version: string };
  singletons?: Record<string, string>;
}): Array<{ pkg: string; expected: string; actual: string }>;`}
      />

      <h2 id="health">Health</h2>
      <CodeBlock
        language="ts"
        code={`createHealthHandler(opts: {
  name: string;
  version: string;
  build?: string;
  shared?: Record<string, string>;
  probes?: Record<string, () => Promise<{ ok: boolean; detail?: string }>>;
}): (req: Request) => Promise<{ status: number; body: HealthBody }>;

fetchHealth(url: string, opts?: { timeoutMs?: number }): Promise<HealthBody>;`}
      />

      <h2 id="telemetry">Telemetry</h2>
      <ul>
        <li><code>onRemoteLoad(cb): () =&gt; void</code></li>
        <li><code>onRuntimeError(cb): () =&gt; void</code></li>
        <li><code>emitRemoteLoad(detail)</code> / <code>emitError(detail)</code></li>
        <li>DOM events: <code>moxjs:navigate</code>, <code>moxjs:remote-load</code>, <code>moxjs:error</code></li>
      </ul>

      <h2 id="dev-reload">Dev reload</h2>
      <ul>
        <li><code>connectMoxjsDevReload(url?: string): () =&gt; void</code> — opens a WS to the host&apos;s reload server; auto-injected when <code>MOXJS_DEV_RELOAD_URL</code> is set</li>
      </ul>
    </>
  );
}
