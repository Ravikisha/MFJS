'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOC_NAV } from '@/app/docs/nav';
import { cn } from '@/lib/utils';

export function DocsSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';
  return (
    <aside
      className={cn(
        'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start overflow-y-auto py-8 pr-4 lg:block',
        className,
      )}
    >
      <nav className="space-y-7" aria-label="Documentation">
        {DOC_NAV.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.links.map((l) => {
                const active = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-accent/10 text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-r bg-accent"
                          style={{ width: 2 }}
                        />
                      )}
                      <span className="truncate">{l.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
