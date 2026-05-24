export interface DocSection {
  title: string;
  links: DocLink[];
}

export interface DocLink {
  href: string;
  label: string;
}

export const DOC_NAV: DocSection[] = [
  {
    title: 'Get started',
    links: [
      { href: '/docs/getting-started', label: 'Getting started' },
      { href: '/docs/concepts', label: 'Concepts' },
      { href: '/docs/cli', label: 'CLI reference' },
    ],
  },
  {
    title: 'Core',
    links: [
      { href: '/docs/routing', label: 'Routing' },
      { href: '/docs/nested-routes', label: 'Nested routes' },
      { href: '/docs/typed-routes', label: 'Typed routes' },
      { href: '/docs/view-transitions', label: 'View transitions' },
      { href: '/docs/prefetch', label: 'Prefetch on hover' },
      { href: '/docs/concurrent-preload', label: 'Concurrent preload' },
      { href: '/docs/federation', label: 'Module Federation' },
      { href: '/docs/state', label: 'State & event bus' },
      { href: '/docs/ssr', label: 'SSR & static export' },
      { href: '/docs/islands', label: 'Islands hydration' },
    ],
  },
  {
    title: 'Runtime extras',
    links: [
      { href: '/docs/css-isolation', label: 'CSS isolation (Shadow DOM)' },
      { href: '/docs/image', label: 'Image optimization' },
      { href: '/docs/fonts', label: 'Font optimization' },
      { href: '/docs/service-worker', label: 'Service Worker' },
      { href: '/docs/rsc', label: 'React Server Components' },
    ],
  },
  {
    title: 'Production',
    links: [
      { href: '/docs/security', label: 'Security' },
      { href: '/docs/observability', label: 'Observability' },
      { href: '/docs/deployment', label: 'Deployment' },
      { href: '/docs/production-checklist', label: 'Production checklist' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'API reference',
    links: [
      { href: '/docs/api/runtime', label: '@jorvel/runtime' },
      { href: '/docs/api/ssr', label: '@jorvel/ssr' },
      { href: '/docs/api/security', label: '@jorvel/security' },
      { href: '/docs/api/observability', label: '@jorvel/observability' },
      { href: '/docs/api/state', label: '@jorvel/state' },
      { href: '/docs/api/event-bus', label: '@jorvel/event-bus' },
    ],
  },
];
