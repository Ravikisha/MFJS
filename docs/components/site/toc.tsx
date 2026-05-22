'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * Auto-generated table of contents. Reads h2 / h3 inside the rendered article
 * and tracks the current section via IntersectionObserver.
 */
export function DocsToc({ className }: { className?: string }) {
  const [headings, setHeadings] = React.useState<Heading[]>([]);
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    const article = document.querySelector('article.prose-moxjs');
    if (!article) return;
    const nodes = Array.from(article.querySelectorAll<HTMLElement>('h2, h3'));
    const list: Heading[] = [];
    for (const node of nodes) {
      if (!node.id) {
        const id = (node.textContent ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
        if (id) node.id = id;
      }
      list.push({
        id: node.id,
        text: node.textContent ?? '',
        level: node.tagName === 'H3' ? 3 : 2,
      });
    }
    setHeadings(list);

    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside
      className={cn(
        'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start overflow-y-auto py-8 pl-4 xl:block',
        className,
      )}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1.5 border-l border-border pl-3 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'pl-3' : ''}>
            <a
              href={`#${h.id}`}
              className={cn(
                '-ml-px block border-l border-transparent py-0.5 text-muted-foreground transition-colors hover:text-foreground',
                active === h.id && 'border-accent text-foreground',
              )}
              style={active === h.id ? { marginLeft: '-13px', paddingLeft: '12px' } : undefined}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
