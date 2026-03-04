import React from 'react';
import ReactDOM from 'react-dom/client';
import { loadRemoteModule } from '@mfjs/runtime';

type RemoteModule = { default: React.ComponentType };

type FederationConfig = {
  remotes?: Record<string, string>;
};

function parseRemoteFromFederation(spec: string) {
  const [name, entryUrl] = spec.split('@');
  if (!name || !entryUrl) return null;
  return { name, entryUrl };
}

function App() {
  const [Remote, setRemote] = React.useState<React.ComponentType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const run = async () => {
      try {
        const federationFile = (import.meta as any).env?.MFJS_FEDERATION_FILE || 'mfjs.federation.json';
        const federationUrl = `/${federationFile}`;

        console.log(`Fetching federation config from ${federationUrl}`);

        const res = await fetch(federationUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${federationUrl}`);

        console.log(`Fetched federation config: ${await res.clone().text()}`);

        const cfg = (await res.json()) as FederationConfig;
        const spec = cfg.remotes?.dashboard;
        if (!spec) throw new Error('Remote not found in federation config: dashboard');

        console.log(`Remote spec for dashboard: ${spec}`);

        const remote = parseRemoteFromFederation(spec);
        if (!remote) throw new Error('Invalid remote spec: ' + spec);

        console.log(`Parsed remote: ${JSON.stringify(remote)}`);

        const mod = await loadRemoteModule<RemoteModule>(remote, './App');

        console.log(`Loaded remote module: ${mod.default}`);
        setError(null);
        setRemote(() => mod.default);
      } catch (e) {
        console.error('Error loading remote module:', e);
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    void run();
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>shell (host)</h1>
      <p>
        Loading remote from <code>mfjs.federation.json</code>: <code>dashboard</code>
      </p>
      {error ? (
        <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>{error}</pre>
      ) : Remote ? (
        <>
          <div data-testid="remote-loaded">remote-loaded</div>
          <Remote />
        </>
      ) : (
        <p>Loading remote...</p>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
