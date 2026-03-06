import React from 'react';
import { resolveRemotePage } from '@mfjs/runtime';
import { pages } from './mfjs.routes.js';

type RemoteAppProps = {
  /** Subpath relative to the remote base, e.g. "/" or "/settings" or "/users/42" */
  subpath?: string;
};

export default function RemoteApp({ subpath = '/' }: RemoteAppProps) {
  const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [params, setParams]       = React.useState<Record<string, string>>({});
  const [error, setError]         = React.useState<string | null>(null);
  const [loading, setLoading]     = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    resolveRemotePage(pages, subpath)
      .then((result) => {
        if (!cancelled) {
          if (result) {
            setComponent(() => result.Component);
            setParams(result.params);
          } else {
            setComponent(null);
          }
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [subpath]);

  if (loading) return <p data-testid="loading-page" style={{ color: '#888' }}>Loading page…</p>;
  if (error)   return <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!Component)
    return (
      <div
        data-testid="remote-loaded"
        style={{ padding: 16, border: '2px solid #f87171', borderRadius: 8 }}
      >
        <p>404 — No page found for subpath: <code>{subpath}</code></p>
      </div>
    );

  return (
    <div
      data-testid="remote-loaded"
      style={{ padding: 16, border: '2px solid #6366f1', borderRadius: 8 }}
    >
      <Component params={params} />
    </div>
  );
}

