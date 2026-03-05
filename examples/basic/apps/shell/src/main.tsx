import React from 'react';
import ReactDOM from 'react-dom/client';
import { createRouter, loadRemoteModule, resolveRemotePage, resolveRoute, type RouteTarget } from '@mfjs/runtime';

type RemoteModule = { default: React.ComponentType };

type RemoteRoutesModule = {
  pages: Array<{ path: string; load: () => Promise<{ default: React.ComponentType<any> }> }>;
};

type FederationConfig = {
  remotes?: Record<string, string>;
};

type HostRoutesManifest = {
  routes: RouteTarget[];
};

function parseRemoteFromFederation(spec: string) {
  const [name, entryUrl] = spec.split('@');
  if (!name || !entryUrl) return null;
  return { name, entryUrl };
}

const router = createRouter();

const routesFallback: HostRoutesManifest['routes'] = [
  { path: '/', remote: 'dashboard', module: './App' },
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
];

async function loadHostRoutes(): Promise<HostRoutesManifest['routes']> {
  try {
    const res = await fetch('/mfjs.routes.host.json');
    if (!res.ok) return routesFallback;
    const json = (await res.json()) as HostRoutesManifest;
    if (!json?.routes?.length) return routesFallback;
    return json.routes;
  } catch {
    return routesFallback;
  }
}

async function loadRemoteByName(cfg: FederationConfig, remoteName: string) {
  const spec = cfg.remotes?.[remoteName];
  if (!spec) throw new Error('Remote not found in federation config: ' + remoteName);
  const remote = parseRemoteFromFederation(spec);
  if (!remote) throw new Error('Invalid remote spec: ' + spec);
  return remote;
}

function App() {
  const [path, setPath] = React.useState(router.getPath());
  const [routes, setRoutes] = React.useState<HostRoutesManifest['routes']>(routesFallback);
  const [Remote, setRemote] = React.useState<React.ComponentType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [matchInfo, setMatchInfo] = React.useState<{ path: string; remote: string; params: Record<string, string> } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingStep, setLoadingStep] = React.useState<string | null>(null);

  React.useEffect(() => {
    return router.subscribe(setPath);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void loadHostRoutes().then((r) => {
      if (mounted) setRoutes(r);
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    const run = async () => {
      try {
  setLoading(true);
  setLoadingStep('fetch federation');
        const federationFile = (import.meta as any).env?.MFJS_FEDERATION_FILE || 'mfjs.federation.json';
        const federationUrl = `/${federationFile}`;

        const res = await fetch(federationUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${federationUrl}`);
        const cfg = (await res.json()) as FederationConfig;

  // NOTE: router.getPath() includes optional search/hash.
  // matchPath() already normalizes and ignores ?/#, so pass the full path
  // to avoid edge-cases where the "pathname" becomes an empty string.
  // If we're at the root, ensure we match the root route even if the
  // route table contains more specific patterns first.
  const normalizedPath = path.split('?')[0].split('#')[0] || '/';
  const hit = resolveRoute(routes, normalizedPath);
        if (!hit) {
          setRemote(null);
          setError(null);
          setMatchInfo(null);
          return;
        }

        setMatchInfo({ path: hit.target.path, remote: hit.target.remote, params: hit.params });

        const remoteName = hit.target.remote;
  setLoadingStep(`resolve remote ${remoteName}`);
        const remote = await loadRemoteByName(cfg, remoteName);

  // Compute the remote subpath for file-based routing.
  // - If the host matched /<remote>/*, we use the splat remainder.
  // - If the host matched '/', we treat it like the remote's '/', not the host's path.
  const subpath = hit.params['*'] ? '/' + hit.params['*'] : '/';

        // Preferred: remote file-based page routing via ./Routes + resolveRemotePage().
        // Fallback: remote ./App.
        try {
          setLoadingStep('load ./Routes');
          const routesMod = await loadRemoteModule<RemoteRoutesModule>(remote, './Routes');
          setLoadingStep('resolve remote page');
          const page = await resolveRemotePage(routesMod.pages, subpath);
          if (page?.Component) {
            setError(null);
            setRemote(() => page.Component);
            return;
          }
        } catch {
          // ignore and fall back to ./App
        }

        setLoadingStep(`load ${hit.target.module || './App'}`);
        const mod = await loadRemoteModule<RemoteModule>(remote, hit.target.module || './App');
        setError(null);
        setRemote(() => mod.default);
      } catch (e) {
        setRemote(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setLoadingStep(null);
      }
    };

    void run();
  }, [path, routes]);

  return (
    <div style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>shell (host)</h1>
      <p>Current path: <code>{path}</code></p>
      <p style={{ opacity: 0.7 }}>
        Routes loaded: <code>{routes.length}</code>{' '}
        {routes[0] ? (
          <>
            (first: <code>{routes[0].path}</code> → <code>{routes[0].remote}</code>)
          </>
        ) : null}
      </p>
      <p style={{ opacity: 0.7 }}>
        Match:{' '}
        {matchInfo ? (
          <>
            <code>{matchInfo.path}</code> → <code>{matchInfo.remote}</code>{' '}
            <span style={{ opacity: 0.7 }}>(params: {JSON.stringify(matchInfo.params)})</span>
          </>
        ) : (
          <code>null</code>
        )}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => router.navigate({ to: '/' })}>/</button>
        <button onClick={() => router.navigate({ to: '/dashboard' })}>/dashboard</button>
        <button onClick={() => router.navigate({ to: '/dashboard/reports/1' })}>/dashboard/reports/1</button>
      </div>
      {error ? (
        <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>{error}</pre>
      ) : Remote ? (
        <>
          <div data-testid="remote-loaded">remote-loaded</div>
          <Remote />
        </>
      ) : matchInfo && loading ? (
        <p>
          Loading remote… {loadingStep ? <span style={{ opacity: 0.7 }}>(step: <code>{loadingStep}</code>)</span> : null}
        </p>
      ) : (
        <p>No route matched.</p>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
