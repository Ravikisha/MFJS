export interface SearchEntry {
  href: string;
  title: string;
  section: string;
  description: string;
  keywords: string[];
}

export const SEARCH_INDEX: SearchEntry[] = [
  // Get started
  {
    href: '/docs/getting-started',
    title: 'Getting started',
    section: 'Get started',
    description: 'Install the CLI, scaffold a workspace, run host + remote in dev.',
    keywords: ['install', 'init', 'scaffold', 'quickstart', 'setup', 'npx', 'create', 'new project'],
  },
  {
    href: '/docs/concepts',
    title: 'Core concepts',
    section: 'Get started',
    description: 'Host vs remote, federation contracts, runtime, routing model.',
    keywords: ['host', 'remote', 'shell', 'contract', 'architecture', 'overview', 'mental model'],
  },
  {
    href: '/docs/cli',
    title: 'CLI reference',
    section: 'Get started',
    description: 'jorvel init, generate, dev, build, federation, routes, ssr, deploy.',
    keywords: ['cli', 'command', 'init', 'generate', 'dev', 'build', 'deploy', 'federation', 'scaffold', 'analyze', 'diagnose'],
  },

  // Core
  {
    href: '/docs/routing',
    title: 'Routing',
    section: 'Core',
    description: 'File-based routes, navigation, params, layouts.',
    keywords: ['route', 'router', 'navigation', 'link', 'params', 'pages', 'file-based'],
  },
  {
    href: '/docs/nested-routes',
    title: 'Nested routes',
    section: 'Core',
    description: 'Layouts, child routes, outlets, route nesting.',
    keywords: ['nested', 'layout', 'outlet', 'child route', 'parent'],
  },
  {
    href: '/docs/typed-routes',
    title: 'Typed routes',
    section: 'Core',
    description: 'Type-safe links and params generated from your routes.',
    keywords: ['typescript', 'typed', 'type-safe', 'codegen', 'route types', 'autocomplete'],
  },
  {
    href: '/docs/view-transitions',
    title: 'View transitions',
    section: 'Core',
    description: 'Cross-fade and morph between routes via View Transitions API.',
    keywords: ['transition', 'animation', 'view transitions', 'morph', 'cross-fade', 'navigation animation'],
  },
  {
    href: '/docs/prefetch',
    title: 'Prefetch on hover',
    section: 'Core',
    description: 'Preload remote chunks and data on link hover or viewport.',
    keywords: ['prefetch', 'preload', 'hover', 'intersection', 'lazy', 'performance'],
  },
  {
    href: '/docs/concurrent-preload',
    title: 'Concurrent preload',
    section: 'Core',
    description: 'Parallel remote container init for faster first nav.',
    keywords: ['concurrent', 'parallel', 'preload', 'remote container', 'startup', 'cold start'],
  },
  {
    href: '/docs/federation',
    title: 'Module Federation',
    section: 'Core',
    description: 'Rspack Module Federation config, exposes, shared, remotes.',
    keywords: ['federation', 'module federation', 'rspack', 'webpack', 'remote', 'expose', 'shared', 'singleton'],
  },
  {
    href: '/docs/state',
    title: 'State & event bus',
    section: 'Core',
    description: 'Shared store, cross-remote events, typed event bus.',
    keywords: ['state', 'store', 'event bus', 'pubsub', 'broadcast', 'communication', 'cross-remote'],
  },
  {
    href: '/docs/ssr',
    title: 'SSR & static export',
    section: 'Core',
    description: 'Server rendering, streaming, SSG, edge adapters.',
    keywords: ['ssr', 'server side rendering', 'static', 'ssg', 'streaming', 'edge', 'hydration', 'node', 'cloudflare', 'vercel'],
  },
  {
    href: '/docs/islands',
    title: 'Islands hydration',
    section: 'Core',
    description: 'Selective hydration of interactive islands for low JS.',
    keywords: ['islands', 'hydration', 'partial', 'selective', 'interactive', 'astro-like'],
  },

  // Runtime extras
  {
    href: '/docs/css-isolation',
    title: 'CSS isolation (Shadow DOM)',
    section: 'Runtime extras',
    description: 'Scope remote styles with Shadow DOM to prevent leaks.',
    keywords: ['css', 'shadow dom', 'isolation', 'scoped styles', 'encapsulation', 'leak'],
  },
  {
    href: '/docs/service-worker',
    title: 'Service Worker',
    section: 'Runtime extras',
    description: 'Offline, caching, background sync for federated apps.',
    keywords: ['service worker', 'sw', 'offline', 'cache', 'pwa', 'workbox'],
  },
  {
    href: '/docs/rsc',
    title: 'React Server Components',
    section: 'Runtime extras',
    description: 'RSC integration patterns for federated boundaries.',
    keywords: ['rsc', 'react server components', 'server components', 'react 19'],
  },

  // Production
  {
    href: '/docs/security',
    title: 'Security',
    section: 'Production',
    description: 'CSP, SRI, allowlist, sanitize, rate limit, audit.',
    keywords: ['security', 'csp', 'content security policy', 'sri', 'subresource integrity', 'allowlist', 'sanitize', 'xss', 'rate limit', 'audit'],
  },
  {
    href: '/docs/observability',
    title: 'Observability',
    section: 'Production',
    description: 'Logger, OTEL adapter, Sentry, fingerprint, hooks.',
    keywords: ['observability', 'logging', 'logger', 'otel', 'opentelemetry', 'sentry', 'tracing', 'metrics', 'monitoring'],
  },
  {
    href: '/docs/deployment',
    title: 'Deployment',
    section: 'Production',
    description: 'Deploy to Node, Vercel, Cloudflare, static hosts.',
    keywords: ['deploy', 'deployment', 'production', 'vercel', 'cloudflare', 'node', 'docker', 'host'],
  },
  {
    href: '/docs/production-checklist',
    title: 'Production checklist',
    section: 'Production',
    description: 'Pre-launch checklist: perf, security, observability, CI.',
    keywords: ['checklist', 'production', 'launch', 'audit', 'go-live', 'readiness'],
  },
  {
    href: '/docs/troubleshooting',
    title: 'Troubleshooting',
    section: 'Production',
    description: 'Common errors, share scope issues, hydration mismatches.',
    keywords: ['troubleshoot', 'error', 'debug', 'share scope', 'hydration mismatch', 'fix', 'problem'],
  },

  // API reference
  {
    href: '/docs/api/runtime',
    title: '@jorvel/runtime',
    section: 'API reference',
    description: 'Router, RemoteOutlet, hooks, remote loader, guards.',
    keywords: ['runtime', 'api', 'router', 'remoteoutlet', 'hooks', 'guards', 'useremote'],
  },
  {
    href: '/docs/api/ssr',
    title: '@jorvel/ssr',
    section: 'API reference',
    description: 'renderToString, renderToStream, edge adapter, static export.',
    keywords: ['ssr', 'api', 'rendertostring', 'rendertostream', 'edge', 'adapter', 'static export'],
  },
  {
    href: '/docs/api/security',
    title: '@jorvel/security',
    section: 'API reference',
    description: 'CSP builder, SRI helper, sanitize, allowlist, rate limit.',
    keywords: ['security api', 'csp', 'sri', 'sanitize', 'allowlist', 'rate limit', 'audit'],
  },
  {
    href: '/docs/api/observability',
    title: '@jorvel/observability',
    section: 'API reference',
    description: 'Logger, adapters (console/otel/sentry), fingerprint, hooks.',
    keywords: ['observability api', 'logger', 'otel', 'sentry', 'fingerprint', 'adapters'],
  },
  {
    href: '/docs/api/state',
    title: '@jorvel/state',
    section: 'API reference',
    description: 'Store, devtools, persist, middleware, React bindings.',
    keywords: ['state api', 'store', 'devtools', 'persist', 'middleware', 'react'],
  },
  {
    href: '/docs/api/event-bus',
    title: '@jorvel/event-bus',
    section: 'API reference',
    description: 'Typed event bus, broadcast channel, schema validation.',
    keywords: ['event bus', 'pubsub', 'broadcast', 'schema', 'typed events', 'channel'],
  },
];

export interface SearchResult extends SearchEntry {
  score: number;
}

export function searchDocs(query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const entry of SEARCH_INDEX) {
    const title = entry.title.toLowerCase();
    const desc = entry.description.toLowerCase();
    const section = entry.section.toLowerCase();
    const kw = entry.keywords.join(' ').toLowerCase();
    const haystack = `${title} ${desc} ${section} ${kw}`;

    let score = 0;
    let allTokensMatched = true;

    for (const t of tokens) {
      if (title === t) score += 100;
      else if (title.startsWith(t)) score += 60;
      else if (title.includes(t)) score += 40;
      else if (entry.keywords.some((k) => k.toLowerCase() === t)) score += 35;
      else if (kw.includes(t)) score += 20;
      else if (desc.includes(t)) score += 10;
      else if (section.includes(t)) score += 5;
      else if (haystack.includes(t)) score += 3;
      else {
        allTokensMatched = false;
        break;
      }
    }

    if (allTokensMatched && score > 0) {
      results.push({ ...entry, score });
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return results.slice(0, limit);
}
