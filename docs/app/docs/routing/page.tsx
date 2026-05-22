import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Routing',
  description:
    'Two-tier router built on the History API. Host owns top-level URLs, remotes own sub-paths. No react-router dependency.',
};

export default function Routing() {
  return (
    <>
      <h1>Routing</h1>
      <p>
        MOXJS routing has two tiers: the <strong>host</strong> owns top-level routes, each{' '}
        <strong>remote</strong> owns its sub-routes. Both layers are built on the browser{' '}
        <code>History</code> API — no <code>react-router</code> required, no extra context, no
        wrapper providers needed in remotes.
      </p>

      <h2 id="why-two-tier">Why two tiers?</h2>
      <p>
        A single router would force the host to import every remote&apos;s page table at build
        time, defeating the purpose of federation. MOXJS splits the table: the host decides{' '}
        <em>which remote handles which prefix</em>, the remote decides{' '}
        <em>how to render the sub-path</em>. The two tables meet at runtime via{' '}
        <code>usePathname()</code>.
      </p>
      <CodeBlock
        language="text"
        code={`URL: /dashboard/users/42

Host tier         Remote tier
─────────         ───────────
/dashboard/*  →   /users/:id        (matched inside the remote)
/billing/*    →   /invoices/:id
/             →   /                  (root delegate)`}
      />

      <h2>Host routes</h2>
      <CodeBlock
        language="tsx"
        filename="apps/shell/src/bootstrap.tsx"
        code={`import { NavLink, RemoteOutlet, getRouter } from '@moxjs/runtime';
import type { RouteTarget } from '@moxjs/runtime';

const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

const REMOTES = {
  dashboard: () => import('dashboard/App'),
};

getRouter(); // singleton, safe under StrictMode

export default function App() {
  return (
    <>
      <header>
        <NavLink to="/" label="Home" />
        <NavLink to="/dashboard/settings" label="Settings" />
      </header>
      <main>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </>
  );
}`}
      />

      <h2>Remote pages (file-based)</h2>
      <CodeBlock
        language="text"
        code={`apps/dashboard/src/pages/
├── index.tsx         // -> /
├── settings.tsx      // -> /settings
└── users/[id].tsx    // -> /users/:id`}
      />

      <p>
        Run <code>moxjs routes</code> to compile this tree into <code>src/moxjs.routes.ts</code> and pass it to{' '}
        <code>RemoteApp</code>:
      </p>

      <CodeBlock
        language="tsx"
        filename="apps/dashboard/src/remote.tsx"
        code={`import { RemoteApp } from '@moxjs/runtime';
import { pages } from './moxjs.routes.js';

export default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {
  return <RemoteApp subpath={subpath} pages={pages} />;
}`}
      />

      <h2 id="hooks">Hooks</h2>
      <p>
        All hooks subscribe to the same singleton router, so a state update in any remote
        re-renders subscribers in any other remote — no manual wiring.
      </p>
      <table>
        <thead>
          <tr>
            <th>Hook</th>
            <th>Returns</th>
            <th>Re-renders when</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>useRouter()</code></td>
            <td>Singleton <code>Router</code> instance</td>
            <td>Never (stable identity)</td>
          </tr>
          <tr>
            <td><code>usePathname()</code></td>
            <td><code>string</code> — pathname + search + hash</td>
            <td>Any navigation</td>
          </tr>
          <tr>
            <td><code>useSearchParams()</code></td>
            <td>
              <code>
                [URLSearchParams, (next, mode?: &apos;push&apos; | &apos;replace&apos;) =&gt; void]
              </code>
            </td>
            <td>Query-string changes</td>
          </tr>
          <tr>
            <td><code>useQueryParam(key)</code></td>
            <td>
              <code>[string | null, (next) =&gt; void]</code>
            </td>
            <td>That key changes</td>
          </tr>
          <tr>
            <td><code>useParams&lt;T&gt;()</code></td>
            <td>Typed params from the nearest provider</td>
            <td>Match changes</td>
          </tr>
          <tr>
            <td><code>useNavigate()</code></td>
            <td>
              <code>
                (to, opts?: &#123; replace?, state? &#125;) =&gt; void
              </code>
            </td>
            <td>Never</td>
          </tr>
          <tr>
            <td><code>useNavigationEvents(fn)</code></td>
            <td><code>void</code></td>
            <td>Fires <code>start</code> + <code>complete</code> events</td>
          </tr>
          <tr>
            <td><code>useRemoteData({'{ key, fetcher, ttl? }'})</code></td>
            <td>
              <code>
                &#123; data, error, loading, refresh &#125;
              </code>
            </td>
            <td>Resolution + revalidation</td>
          </tr>
        </tbody>
      </table>

      <h3>useNavigate() — imperative</h3>
      <CodeBlock
        language="tsx"
        code={`import { useNavigate } from '@moxjs/runtime';

function LogoutButton() {
  const navigate = useNavigate();
  return (
    <button onClick={async () => {
      await fetch('/api/logout', { method: 'POST' });
      navigate('/login', { replace: true, state: { reason: 'logout' } });
    }}>
      Sign out
    </button>
  );
}`}
      />

      <h3>useSearchParams() — reactive query string</h3>
      <CodeBlock
        language="tsx"
        code={`import { useSearchParams } from '@moxjs/runtime';

function Filters() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';

  return (
    <select value={tab} onChange={(e) => {
      const next = new URLSearchParams(params);
      next.set('tab', e.target.value);
      setParams(next, 'replace');   // 'replace' keeps history clean for filter changes
    }}>
      <option>overview</option>
      <option>activity</option>
    </select>
  );
}`}
      />

      <h3>useNavigationEvents() — instrumentation</h3>
      <CodeBlock
        language="ts"
        code={`useNavigationEvents((event) => {
  if (event.phase === 'start')    perf.mark('nav-start');
  if (event.phase === 'complete') perf.measure('nav', 'nav-start');
});`}
      />

      <h2 id="dynamic">Dynamic segments</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Route</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>pages/users/[id].tsx</code></td>
            <td><code>/users/:id</code></td>
            <td>Single segment</td>
          </tr>
          <tr>
            <td><code>pages/docs/[...rest].tsx</code></td>
            <td><code>/docs/*</code></td>
            <td>Splat — matches the remainder</td>
          </tr>
          <tr>
            <td><code>pages/(marketing)/about.tsx</code></td>
            <td><code>/about</code></td>
            <td>
              Parentheses are a route group — no URL segment is emitted; useful for shared layouts
            </td>
          </tr>
          <tr>
            <td><code>pages/(auth)/login.tsx</code></td>
            <td><code>/login</code></td>
            <td>Same — groups never appear in the URL</td>
          </tr>
        </tbody>
      </table>

      <p>Read params from inside the page component:</p>
      <CodeBlock
        language="tsx"
        filename="pages/users/[id].tsx"
        code={`import { useParams } from '@moxjs/runtime';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();   // matched against [id]
  return <h1>User {id}</h1>;
}`}
      />

      <h2>Route guards</h2>
      <CodeBlock
        language="ts"
        code={`import { createAuthGuard, runGuards } from '@moxjs/runtime';

const authGuard = createAuthGuard({
  isAuthenticated: () => !!localStorage.getItem('token'),
  loginPath: '/login',
});

const routes = [
  {
    path: '/dashboard/*',
    remote: 'dashboard',
    module: './App',
    guards: [authGuard],
  },
];`}
      />

      <p>
        Guards run in order; a falsy result blocks the route, and <code>&#123; redirect &#125;</code>{' '}
        redirects instead. <code>runGuards()</code> lets you integrate the chain into a custom outlet.
      </p>

      <h2 id="cross-app">Cross-app navigation</h2>
      <p>
        Remote code can navigate without importing the router by dispatching a DOM event. The host
        listens via <code>attachMoxjsNavigateListener()</code> (auto-installed by{' '}
        <code>getRouter()</code>) and turns the event into a <code>history.pushState</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import { dispatchMoxjsNavigate } from '@moxjs/runtime';

dispatchMoxjsNavigate({ to: '/dashboard/settings' });               // push
dispatchMoxjsNavigate({ to: '/login', mode: 'replace' });           // replace
dispatchMoxjsNavigate({ to: '/cart', state: { from: 'product' } }); // with history state`}
      />

      <Callout variant="info" title="Why a DOM event instead of an import?">
        The DOM event decouples remotes from the host&apos;s router instance. A remote can be
        loaded standalone (storybook, tests, a different host) and still call the same API — the
        event just no-ops when no host is listening.
      </Callout>

      <h2 id="error-boundary">Error boundaries</h2>
      <p>
        Wrap each <code>RemoteOutlet</code> in an <code>ErrorBoundary</code> so a single remote
        crash never blanks the host. The bundled boundary calls{' '}
        <code>reportError()</code> from <code>@moxjs/observability</code> automatically.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { ErrorBoundary, RemoteOutlet } from '@moxjs/runtime';

<ErrorBoundary fallback={(err, reset) => (
  <div role="alert">
    <p>{err.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
</ErrorBoundary>`}
      />

      <h2 id="ssr-routing">Routing during SSR</h2>
      <p>
        On the server, the History API is not available. Use{' '}
        <code>createServerRouter(pathname)</code> instead — a synchronous read-only router that
        feeds <code>renderRouteToString</code>:
      </p>
      <CodeBlock
        language="ts"
        code={`import { createServerRouter } from '@moxjs/runtime';
import { renderRouteToString } from '@moxjs/ssr';

const ctx = createServerRouter(request.url);
const result = await renderRouteToString(App, { path: ctx.pathname });`}
      />
    </>
  );
}
