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
      { href: '/docs/api/runtime', label: '@moxjs/runtime' },
      { href: '/docs/api/ssr', label: '@moxjs/ssr' },
      { href: '/docs/api/security', label: '@moxjs/security' },
      { href: '/docs/api/observability', label: '@moxjs/observability' },
      { href: '/docs/api/state', label: '@moxjs/state' },
      { href: '/docs/api/event-bus', label: '@moxjs/event-bus' },
    ],
  },
];
