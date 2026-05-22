export const metadata = { title: 'Production checklist' };

export default function Checklist() {
  const items: Array<{ category: string; tasks: string[] }> = [
    {
      category: 'Security',
      tasks: [
        'Content-Security-Policy header set on every HTML response (buildCsp)',
        'SRI integrity attribute on every remoteEntry.js script tag',
        'RemoteAllowlist wired to getRemoteRegistry',
        'All inline state serialized via safeJsonForScript or serializeState',
        'HTTPS only — HSTS header emitted',
        'CORS restricted to known origins (no wildcard in prod)',
      ],
    },
    {
      category: 'Observability',
      tasks: [
        'Error reporting adapter installed (Sentry / Rollbar / etc.)',
        'collectWebVitals() called in the shell bootstrap',
        'Structured logger writing JSON to a collector',
        'Alerts configured for error rate, p95 LCP, remote-load error rate',
      ],
    },
    {
      category: 'Performance',
      tasks: [
        'moxjs perf budgets green in CI',
        'Bundle analyzer run before each release',
        'Remote preload tags in SSR head (remoteEntryPreloads)',
        'Cache-Control tuned per route (cacheControl helper)',
        'Assets hashed and served with immutable cache-control',
        'Compression (gzip + brotli) enabled at the edge',
      ],
    },
    {
      category: 'Reliability',
      tasks: [
        'Health check endpoint per remote',
        'RemoteRegistry fetches manifest with retry',
        'Error boundary around every RemoteOutlet',
        'Version mismatch warnings surfaced in logs',
        'Graceful fallback UI when a remote fails to load',
      ],
    },
    {
      category: 'Deploy',
      tasks: [
        'Adapter scaffolded (Vercel / Cloudflare / Node / Docker)',
        'CDN publicPath set in moxjs.config.ts',
        'Preview deploy per PR (moxjs ci affected)',
        'Rollback plan documented',
        'Secrets stored in the platform secret manager — never in .env checked in',
      ],
    },
    {
      category: 'Release process',
      tasks: [
        'Changesets workflow on main',
        'SemVer for every published package',
        'CHANGELOG.md per package up to date',
        'Git tags for each release',
        '`@moxjs/cli` version printed in every error report',
      ],
    },
  ];

  return (
    <>
      <h1>Production checklist</h1>
      <p>
        Before flipping the DNS, confirm every item below. Items link to the feature that implements them.
      </p>

      {items.map((group) => (
        <section key={group.category}>
          <h2>{group.category}</h2>
          <ul>
            {group.tasks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}

      <div className="callout callout-warn mt-8">
        <strong>Dry-run tip:</strong> copy this checklist into your release-readiness doc and sign off item
        by item. Anything unchecked is a launch blocker.
      </div>
    </>
  );
}
