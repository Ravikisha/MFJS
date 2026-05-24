import type { MetadataRoute } from 'next';
import { DOC_NAV } from './docs/nav';

const SITE_URL = 'https://jorveljs.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
  ];
  const docRoutes: MetadataRoute.Sitemap = DOC_NAV.flatMap((section) =>
    section.links.map((link) => ({
      url: `${SITE_URL}${link.href}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  );
  return [...staticRoutes, ...docRoutes];
}
