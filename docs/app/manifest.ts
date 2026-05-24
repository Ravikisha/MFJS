import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JORVEL — Production-grade micro-frontends',
    short_name: 'JORVEL',
    description:
      'Opinionated, zero-config micro-frontend framework built on Rspack Module Federation.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#a3e635',
    orientation: 'portrait',
    categories: ['developer', 'productivity', 'utilities'],
    icons: [
      {
        src: '/jorvel-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
  };
}
